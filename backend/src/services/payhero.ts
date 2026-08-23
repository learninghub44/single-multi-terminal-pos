import { Env } from '../types';

interface PayHeroConfig {
  apiKey: string;
  apiUrl: string;
  callbackUrl: string;
  channelId: string;
  provider: string;
}

export class PayHeroPaymentService {
  private config: PayHeroConfig;
  private baseUrl = 'https://backend.payhero.co.ke/api/v2';

  constructor(env: Env) {
    this.config = {
      apiKey: env.PAYHERO_API_KEY,
      apiUrl: env.PAYHERO_API_URL || this.baseUrl,
      callbackUrl: env.PAYHERO_CALLBACK_URL,
      channelId: env.PAYHERO_CHANNEL_ID,
      provider: env.PAYHERO_PROVIDER || 'm-pesa'
    };

    if (env.PAYHERO_API_URL) {
      this.baseUrl = env.PAYHERO_API_URL;
    }
  }

  private getAuthHeader(): string {
    // PAYHERO_API_KEY is expected to already be the "Basic <token>" credential
    // shown in the PayHero dashboard (Settings > API), not a raw username:password.
    return `Basic ${this.config.apiKey}`;
  }

  /**
   * PayHero requires the phone in local format (07XXXXXXXX / 01XXXXXXXX)
   * per their documented examples, not the 2547XXXXXXXX format Safaricom's
   * own Daraja API wants.
   */
  private formatPhoneLocal(phone: string): string {
    let digits = phone.replace(/[^0-9]/g, '');
    if (digits.startsWith('254')) {
      digits = '0' + digits.slice(3);
    } else if (!digits.startsWith('0')) {
      digits = '0' + digits;
    }
    return digits;
  }

  async initiatePayment(
    phone: string,
    amount: number,
    reference: string,
    customerName?: string
  ): Promise<{
    status: 'PENDING' | 'FAILED';
    reference?: string;
    provider_reference?: string;
    transaction_id?: string;
    message?: string;
    raw_response?: unknown;
  }> {
    if (!this.config.apiKey) {
      return { status: 'FAILED', message: 'PayHero is not configured (missing PAYHERO_API_KEY)' };
    }
    if (!this.config.channelId) {
      return { status: 'FAILED', message: 'PayHero is not configured (missing PAYHERO_CHANNEL_ID)' };
    }

    try {
      const formattedPhone = this.formatPhoneLocal(phone);

      // PayHero's STK push endpoint is POST /api/v2/payments (NOT /stk_push).
      // channel_id and provider are required fields - omitting them causes
      // silent failures or 422s from their API.
      const body: Record<string, unknown> = {
        amount: Math.round(amount),
        phone_number: formattedPhone,
        channel_id: Number(this.config.channelId),
        provider: this.config.provider,
        external_reference: reference,
        callback_url: this.config.callbackUrl
      };

      if (customerName) {
        body.customer_name = customerName;
      }

      const response = await fetch(`${this.baseUrl}/payments`, {
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

      if (response.ok && (result.success || result.status === 'QUEUED')) {
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
        message: result.message || `PayHero rejected the request (HTTP ${response.status})`,
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

  /**
   * Best-effort status polling. PayHero's callback (webhook) is the
   * authoritative source of truth - this is only used as a fallback when the
   * customer/cashier wants to check without waiting for the callback to land.
   * If PayHero changes this endpoint's shape, worst case this just returns
   * null and the UI keeps waiting for the webhook / a manual override.
   */
  async checkPaymentStatus(reference: string): Promise<{
    status: 'PAID' | 'FAILED' | 'PENDING' | null;
    amount?: number;
    transactionId?: string;
    providerReference?: string;
  } | null> {
    if (!reference) return null;

    try {
      const response = await fetch(
        `${this.baseUrl}/transaction-status?reference=${encodeURIComponent(reference)}`,
        {
          method: 'GET',
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) return null;

      const result = await response.json() as {
        status?: string;
        success?: boolean;
        reference?: string;
        provider_reference?: string;
        amount?: number;
      };

      const status = (result.status || '').toUpperCase();

      if (status === 'SUCCESS' || status === 'COMPLETED') {
        return {
          status: 'PAID',
          amount: result.amount,
          transactionId: result.reference,
          providerReference: result.provider_reference
        };
      }

      if (status === 'FAILED' || status === 'CANCELLED') {
        return { status: 'FAILED' };
      }

      if (status === 'QUEUED' || status === 'PENDING' || status === '') {
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
    // Confirmed callback shape from PayHero docs:
    // { forward_url, status: true, response: { Amount, CheckoutRequestID,
    //   ExternalReference, MerchantRequestID, MpesaReceiptNumber, Phone,
    //   ResultCode, ResultDesc, Status } }
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
