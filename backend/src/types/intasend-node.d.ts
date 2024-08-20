declare module 'intasend-node' {
    export default class IntaSend {
      constructor(publishableKey: string, secretKey: string, isTest: boolean);
      collection(): {
        mpesaStkPush(data: {
          first_name: string;
          last_name: string;
          email: string;
          host: string;
          amount: number;
          phone_number: string;
          api_ref: string;
        }): Promise<any>;
      };
    }
  }