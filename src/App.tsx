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

  return (
    <>
      {showEditor ? (
        <EditorPage content={generatedContent} />
      ) : (
        <LandingPage onStart={(content) => {
          setGeneratedContent(content);
          setShowEditor(true);
        }} />
      )}
    </>
  );
}

export default App;
