import { Env } from '../types';

interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  callbackUrl: string;
}

interface MpesaToken {
  access_token: string;
  expires_in: number;
}

interface STKPushResult {
  status: 'PENDING' | 'FAILED';
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
  CustomerMessage?: string;
}

export class MpesaPaymentService {
  private config: MpesaConfig;
  private baseUrl = 'https://sandbox.safaricom.co.ke';
  private token: MpesaToken | null = null;
  private tokenExpiry = 0;

  constructor(env: Env) {
    this.config = {
      consumerKey: env.MPESA_CONSUMER_KEY,
      consumerSecret: env.MPESA_CONSUMER_SECRET,
      passkey: env.MPESA_PASSKEY,
      shortcode: env.MPESA_SHORTCODE,
      callbackUrl: env.MPESA_CALLBACK_URL
    };

    // Use production URL if configured
    if (env.MPESA_CONSUMER_KEY && !env.MPESA_CONSUMER_KEY.startsWith('sandbox')) {
      this.baseUrl = 'https://api.safaricom.co.ke';
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token.access_token;
    }

    const auth = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`
    ).toString('base64');

    const response = await fetch(
      `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get M-Pesa access token');
    }

    this.token = await response.json() as MpesaToken;
    this.tokenExpiry = Date.now() + (this.token.expires_in * 1000) - 60000;

    return this.token.access_token;
  }

  private generatePassword(): string {
    const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);
    const data = `${this.config.shortcode}${this.config.passkey}${timestamp}`;
    return Buffer.from(data).toString('base64');
  }

  async initiatePayment(
    phone: string,
    amount: number,
    reference: string
  ): Promise<{
    status: 'PENDING' | 'FAILED';
    reference?: string;
    provider_reference?: string;
    checkout_request_id?: string;
    message?: string;
    raw_response?: unknown;
  }> {
    try {
      const accessToken = await this.getAccessToken();
      const password = this.generatePassword();
      const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);

      // Format phone number (remove + or leading 0)
      let formattedPhone = phone.replace(/[^0-9]/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.slice(1);
      }
      if (!formattedPhone.startsWith('254')) {
        formattedPhone = '254' + formattedPhone;
      }

      const body = {
        BusinessShortCode: this.config.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: this.config.shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: this.config.callbackUrl,
        AccountReference: reference,
        TransactionDesc: `POS Payment ${reference}`
      };

      const response = await fetch(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }
      );

      const result = await response.json() as STKPushResult;

      if (result.ResponseCode === '0') {
        return {
          status: 'PENDING',
          reference,
          provider_reference: result.CheckoutRequestID,
          checkout_request_id: result.CheckoutRequestID,
          raw_response: result
        };
      }

      return {
        status: 'FAILED',
        message: result.ResponseDescription || 'STK Push failed',
        raw_response: result
      };
    } catch (error) {
      console.error('M-Pesa initiation error:', error);
      return {
        status: 'FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkPaymentStatus(checkoutRequestId: string): Promise<{
    status: 'PAID' | 'FAILED' | 'CANCELLED' | 'PENDING' | null;
    amount?: number;
    transactionId?: string;
  } | null> {
    if (!checkoutRequestId) return null;

    try {
      const accessToken = await this.getAccessToken();
      const password = this.generatePassword();
      const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);

      // NOTE: the previous implementation called /mpesa/transactionstatus/v1/query
      // with a fake "SecurityCredential" (that endpoint needs an RSA-encrypted
      // credential signed with Safaricom's public cert, which this app never had).
      // The correct way to poll an STK push you just initiated is the STK Push
      // Query endpoint, which reuses the same Password/Timestamp as the push itself.
      const response = await fetch(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            BusinessShortCode: this.config.shortcode,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestId
          })
        }
      );

      const result = await response.json() as {
        ResponseCode?: string;
        ResultCode?: string | number;
        ResultDesc?: string;
        errorCode?: string;
      };

      // While the customer hasn't responded to the prompt yet, Safaricom
      // returns an error (e.g. errorCode 500.001.1001 "being processed")
      // rather than a normal ResultCode - treat that as still pending.
      if (result.errorCode) {
        return { status: 'PENDING' };
      }

      const resultCode = result.ResultCode !== undefined ? String(result.ResultCode) : undefined;

      if (resultCode === '0') {
        return { status: 'PAID' };
      }
      if (resultCode === '1032') {
        return { status: 'CANCELLED' };
      }
      if (resultCode !== undefined) {
        return { status: 'FAILED' };
      }

      return { status: 'PENDING' };
    } catch (error) {
      console.error('M-Pesa status check error:', error);
      return null;
    }
  }

  async handleCallback(body: unknown): Promise<{
    success: boolean;
    transactionId?: string;
    amount?: number;
    status: 'PAID' | 'FAILED' | 'CANCELLED';
    reference?: string;
  }> {
    const callback = body as {
      Body?: {
        stkCallback?: {
          MerchantRequestID?: string;
          CheckoutRequestID?: string;
          ResultCode?: number;
          ResultDesc?: string;
        };
      };
    };

    const stkCallback = callback.Body?.stkCallback;
    if (!stkCallback) {
      return { success: false, status: 'FAILED' };
    }

    const { ResultCode, CheckoutRequestID, ResultDesc } = stkCallback;

    if (ResultCode === 0) {
      // Parse metadata for amount and transaction ID
      const metadata = stkCallback as unknown as {
        CallbackMetadata?: {
          Item?: Array<{ Name: string; Value: unknown }>;
        };
      };

      const items = metadata.CallbackMetadata?.Item || [];
      const amountItem = items.find(i => i.Name === 'Amount');
      const transactionIdItem = items.find(i => i.Name === 'MpesaReceiptNumber');

      return {
        success: true,
        status: 'PAID',
        amount: amountItem?.Value as number,
        transactionId: transactionIdItem?.Value as string,
        reference: CheckoutRequestID
      };
    }

    return {
      success: false,
      status: ResultCode === 1032 ? 'CANCELLED' : 'FAILED',
      reference: CheckoutRequestID
    };
  }
}
