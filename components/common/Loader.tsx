
import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-accent-primary"></div>
    </div>
  );
};

export default Loader;
