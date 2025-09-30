import axios, { AxiosError } from "axios";

export async function callApi(
  url: string,
  headers: Record<string, string>,
  data?: unknown
) {
  try {
    const response = await axios.post(url, data, { headers });
    return { success: true, data: response.data };
  } catch (error) {
    const err = error as AxiosError;
    return {
      success: false,
      status: err.response?.status || 500,
      message: err.message,
    };
  }
}
