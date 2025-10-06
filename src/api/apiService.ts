import axios, { AxiosInstance, AxiosRequestConfig, Method } from "axios";
import { ApiResponse } from "../types/ApiResponse";
import { configStore } from "../store/configStore";

export class HttpRequestService {
  private httpClient: AxiosInstance;
  constructor() {
    this.httpClient = axios.create();
  }

  private buildUrl(url: string): string {
    if (!configStore.serverBaseUrl) {
      throw new Error("ApiBaseUrl is not configured.");
    }
    if (!configStore.agentId) {
      throw new Error("Agent ID is not configured.");
    }

    const baseUrl = configStore.serverBaseUrl.replace(/\/+$/, "");
    const fullPath = `${baseUrl}/AxiomProtect/v1/dsagent/${url.replace(/^\/+/, "")}`;

    const requestTime = new Date().toISOString().replace("T", " ").replace("Z", "");
    return `${fullPath}?requestTime=${encodeURIComponent(requestTime)}`;
  }

  private async handleApiResponse<T>(promise: Promise<any>): Promise<ApiResponse<T>> {
    try {
      const response = await promise;
      return response.data as ApiResponse<T>;
    } catch (err: any) {
      if (err.response) {
        const status = err.response.status;
        const data = err.response.data;

        switch (status) {
          case 401:
            throw new Error(`401 Unauthorized: ${JSON.stringify(data)}`);
          case 403:
            throw new Error(`403 Forbidden: ${JSON.stringify(data)}`);
          case 404:
            throw new Error(`404 Not Found: ${JSON.stringify(data)}`);
          case 500:
            throw new Error(`500 Internal Server Error: ${JSON.stringify(data)}`);
          default:
            throw new Error(`${status} Error: ${JSON.stringify(data)}`);
        }
      }
      throw err;
    }
  }

  async postAsync<T>(
    url: string,
    body: any,
    addToken: boolean = false,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    const fullUrl = this.buildUrl(url);
    // console.log("POST URL:", fullUrl);
    // console.log("POST Body:", body);
    if (addToken) {
      const tokenRes = await this.postTokenAsync<{ jwt: string }>();
      // console.log("Token response:", tokenRes);
      if (tokenRes.resultCode === 0 && tokenRes.resultData?.jwt) {
        headers["authToken"] = tokenRes.resultData.jwt;
      }
    }

    return this.handleApiResponse<T>(this.httpClient.post(fullUrl, body, { headers }));
  }

  // async deleteAsync<T>(url: string, addToken: boolean = false, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
  //   const fullUrl = this.buildUrl(url);

  //   if (addToken) {
  //     const tokenRes = await this.postTokenAsync<{ jwt: string }>();
  //     if (tokenRes.resultCode === 0 && tokenRes.resultData?.jwt) {
  //       headers["authToken"] = tokenRes.resultData.jwt;
  //     }
  //   }

  //   return this.handleApiResponse<T>(
  //     this.httpClient.delete(fullUrl, { headers })
  //   );
  // }

  async customCall(
    method: Method,
    url: string,
    addToken: boolean = false,
    headers: Record<string, string> = {}
  ): Promise<any> {
    const fullUrl = this.buildUrl(url);

    if (addToken) {
      const tokenRes = await this.postTokenAsync<{ jwt: string }>();
      if (tokenRes.resultCode === 0 && tokenRes.resultData?.jwt) {
        headers["authToken"] = tokenRes.resultData.jwt;
      }
    }

    const response = await this.httpClient.request({
      method,
      url: fullUrl,
      headers,
    });

    return response.data;
  }

  async postTokenAsync<T>(): Promise<ApiResponse<T>> {
    const fullUrl = this.buildUrl("getAuthenticationToken");

    const body = {
      accountId: configStore.accountId,
      email: configStore.email,
      password: configStore.password,
    };

    // console.log("POST URL:", fullUrl);
    // console.log("POST Body:", body);

    return this.handleApiResponse<T>(
      this.httpClient.post(fullUrl, body, {
        headers: { "Content-Type": "application/json" },
      })
    );
  }
}
