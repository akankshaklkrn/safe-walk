export interface AIMessage {
  id: string;
  text: string;
  timestamp: Date;
}

export const getMockAIMessages = (): AIMessage[] => {
  const now = new Date();
  
  return [
    {
      id: '1',
      text: "Hey! I'm here with you. Let's get you to your destination safely.",
      timestamp: new Date(now.getTime() - 120000), // 2 min ago
    },
    {
      id: '2',
      text: "You're on the right path. The area ahead looks well-lit and active.",
      timestamp: new Date(now.getTime() - 60000), // 1 min ago
    },
    {
      id: '3',
      text: "Everything looks good. About 10 minutes until you arrive.",
      timestamp: new Date(now.getTime() - 30000), // 30 sec ago
    },
  ];
};
