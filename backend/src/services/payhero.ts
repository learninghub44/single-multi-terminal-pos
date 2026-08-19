import { Env } from '../types';

interface PayHeroConfig {
  apiKey: string;
  apiUrl: string;
  callbackUrl: string;
}

interface PayHeroToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class PayHeroPaymentService {
  private config: PayHeroConfig;
  private baseUrl = 'https://backend.payhero.co.ke/api/v2';

  constructor(env: Env) {
    this.config = {
      apiKey: env.PAYHERO_API_KEY,
      apiUrl: env.PAYHERO_API_URL || this.baseUrl,
      callbackUrl: env.PAYHERO_CALLBACK_URL
    };

    if (env.PAYHERO_API_URL) {
      this.baseUrl = env.PAYHERO_API_URL;
    }
  }

  private getAuthHeader(): string {
    return `Basic ${this.config.apiKey}`;
  }

  async initiatePayment(
    phone: string,
    amount: number,
    reference: string,
    channelId?: number
  ): Promise<{
    status: 'PENDING' | 'FAILED';
    reference?: string;
    provider_reference?: string;
    transaction_id?: string;
    message?: string;
    raw_response?: unknown;
  }> {
    try {
      // Format phone number
      let formattedPhone = phone.replace(/[^0-9]/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.slice(1);
      }
      if (!formattedPhone.startsWith('254')) {
        formattedPhone = '254' + formattedPhone;
      }

      const body: Record<string, unknown> = {
        amount: Math.round(amount),
        phone_number: formattedPhone,
        external_reference: reference,
        callback_url: this.config.callbackUrl
      };

      if (channelId) {
        body.channel_id = channelId;
      }

      const response = await fetch(`${this.baseUrl}/ stk_push`, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const result = await response.json() as {
        success?: boolean;
        reference?: string;
        message?: string;
        status?: string;
        CheckoutRequestID?: string;
      };

      if (result.success || result.status === 'QUEUED') {
        return {
          status: 'PENDING',
          reference: result.reference,
          provider_reference: result.CheckoutRequestID || result.reference,
          transaction_id: result.reference,
          raw_response: result
        };
      }

      return {
        status: 'FAILED',
        message: result.message || 'Payment initiation failed',
        raw_response: result
      };
    } catch (error) {
      console.error('PayHero initiation error:', error);
      return {
        status: 'FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkPaymentStatus(reference: string): Promise<{
    status: 'PAID' | 'FAILED' | 'PENDING' | null;
    amount?: number;
    transactionId?: string;
    providerReference?: string;
  } | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/transaction-status?reference=${reference}`,
        {
          method: 'GET',
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json'
          }
        }
      );

      const result = await response.json() as {
        status?: string;
        success?: boolean;
        reference?: string;
        provider_reference?: string;
        amount?: number;
      };

      if (result.status === 'SUCCESS') {
        return {
          status: 'PAID',
          amount: result.amount,
          transactionId: result.reference,
          providerReference: result.provider_reference
        };
      }

      if (result.status === 'FAILED') {
        return { status: 'FAILED' };
      }

      if (result.status === 'QUEUED') {
        return { status: 'PENDING' };
      }

      return null;
    } catch (error) {
      console.error('PayHero status check error:', error);
      return null;
    }
  }

  async handleCallback(body: unknown): Promise<{
    success: boolean;
    transactionId?: string;
    amount?: number;
    status: 'PAID' | 'FAILED' | 'CANCELLED';
    reference?: string;
    providerReference?: string;
    phone?: string;
    customerName?: string;
  }> {
    const callback = body as {
      status?: boolean;
      response?: {
        ResultCode?: number;
        ResultDesc?: string;
        MpesaReceiptNumber?: string;
        ExternalReference?: string;
        CheckoutRequestID?: string;
        Amount?: number;
        Phone?: string;
        Status?: string;
      };
    };

    if (!callback.response) {
      return { success: false, status: 'FAILED' };
    }

    const { ResultCode, MpesaReceiptNumber, ExternalReference, Amount, Phone, Status } = callback.response;

    if (ResultCode === 0 || Status === 'Success') {
      return {
        success: true,
        status: 'PAID',
        amount: Amount,
        transactionId: MpesaReceiptNumber,
        reference: ExternalReference,
        providerReference: MpesaReceiptNumber,
        phone: Phone
      };
    }

    return {
      success: false,
      status: ResultCode === 1032 ? 'CANCELLED' : 'FAILED',
      reference: ExternalReference
    };
  }

  async getPaymentChannels(): Promise<unknown> {
    try {
      const response = await fetch(`${this.baseUrl}/payment_channels`, {
        method: 'GET',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      return await response.json();
    } catch (error) {
      console.error('PayHero get channels error:', error);
      return null;
    }
  }
}
