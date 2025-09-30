export function encrypt(data: string, secret: string): string {
  return Buffer.from(`${data}:${secret}`).toString("base64");
}
