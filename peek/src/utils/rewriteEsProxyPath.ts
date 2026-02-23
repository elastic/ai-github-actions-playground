export const rewriteEsProxyPath = (p: string) => {
  const rewritten = p.replace(/^\/_es(?=\/|\?|$)/, "");
  if (!rewritten) return "/";
  return rewritten.startsWith("?") ? `/${rewritten}` : rewritten;
};
