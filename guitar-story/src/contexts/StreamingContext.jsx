import React, { createContext, useContext } from 'react';

// Create the streaming context
const StreamingContext = createContext({ isStreaming: false });

// Custom hook to use the streaming context
export const useStreamingContext = () => {
  const context = useContext(StreamingContext);
  if (context === undefined) {
    throw new Error('useStreamingContext must be used within a StreamingProvider');
  }
  return context;
};

// Provider component
export const StreamingProvider = ({ children, isStreaming }) => {
  return (
    <StreamingContext.Provider value={{ isStreaming }}>
      {children}
    </StreamingContext.Provider>
  );
};

export default StreamingContext; 