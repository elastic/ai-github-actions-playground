const BASE_IGNORABLE_CONSOLE_PATTERNS = [
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /ERR_NAME_NOT_RESOLVED/,
];

const ES_STATUS_PATTERN = /status of 40[04]/;
const ES_REQUEST_PATH_PATTERN = /\/_es\b/;

export function isIgnorableConsoleError(text) {
  return (
    BASE_IGNORABLE_CONSOLE_PATTERNS.some((re) => re.test(text)) ||
    (ES_STATUS_PATTERN.test(text) && ES_REQUEST_PATH_PATTERN.test(text))
  );
}
