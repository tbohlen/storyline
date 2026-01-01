function truncate(str: string, maxLen: number, ending = '...'): string {
  return str.length > maxLen
    ? str.slice(0, maxLen - ending.length) + ending
    : str;
}

export default truncate;