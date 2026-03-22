const normalizeText = (value: string) => {
  return value.trim().toLowerCase().replace(/[^\w\s]/g, ' ');
};

export const containsSafeWord = (message: string, safeWord: string) => {
  const normalizedMessage = normalizeText(message);
  const normalizedSafeWord = normalizeText(safeWord);

  console.log('------------------------------------', normalizedMessage);
  console.log('--------------------', normalizedSafeWord);


  if (!normalizedSafeWord) {
    return false;
  }

  return normalizedMessage.includes(normalizedSafeWord);
};
