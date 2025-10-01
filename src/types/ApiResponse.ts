export interface ApiResponse<T> {
  resultMessage?: string;
  resultData?: T;
  resultCode: number;
  timestamp?: string;
}

export class ApiResponseModel<T> implements ApiResponse<T> {
  resultMessage?: string;
  resultData?: T;
  resultCode: number = -88;
  timestamp?: string;

  constructor(data: Partial<ApiResponse<T>>) {
    Object.assign(this, data);
  }

  toJson(indented: boolean = false): string {
    return JSON.stringify(this, null, indented ? 2 : 0);
  }
}
