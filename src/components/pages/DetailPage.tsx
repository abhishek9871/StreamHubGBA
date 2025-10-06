
import React from 'react';
import { useParams } from 'react-router-dom';

const DetailPage: React.FC = () => {
  const { type, id } = useParams<{ type: string; id: string }>();

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Detail Page</h1>
        <p className="text-lg text-text-secondary mt-2">
          Content Type: {type}, ID: {id}
        </p>
        <p className="mt-4">Full implementation coming in a future phase!</p>
      </div>
    </div>
  );
};

export default DetailPage;