export function maskSensitive(input: string): string {
  if (!input) return input;
  return input.replace(/.(?=.{4})/g, "*");
}
