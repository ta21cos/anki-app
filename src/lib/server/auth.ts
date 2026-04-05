export function getDeviceId(request: Request): string {
  const token = request.headers.get("X-Device-Token");
  if (!token) {
    throw new Response("Missing device token", { status: 401 });
  }
  return token;
}
