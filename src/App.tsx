import { useState } from 'react';
import LandingPage from './components/LandingPage';
import EditorPage from './components/EditorPage';

function App() {
  const [showEditor, setShowEditor] = useState(false);

  return (
    <>
      {showEditor ? (
        <EditorPage />
      ) : (
        <LandingPage onStart={() => setShowEditor(true)} />
      )}
    </>
  );
}

export default App;
