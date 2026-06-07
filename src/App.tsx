import { useState } from 'react';
import LandingPage from './components/LandingPage';
import EditorPage from './components/EditorPage';

interface GeneratedContent {
  html: string;
  css: string;
}

function App() {
  const [showEditor, setShowEditor] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);

  const handleStartEditor = (content: GeneratedContent | null) => {
    if (!content) {
      alert('No content was generated. Please try again.');
      return;
    }
    setGeneratedContent(content);
    setShowEditor(true);
  };

  return (
    <>
      {showEditor ? (
        <EditorPage
          content={generatedContent}
          onExit={() => setShowEditor(false)}
        />
      ) : (
        <LandingPage onStart={handleStartEditor} />
      )}
    </>
  );
}

export default App;
