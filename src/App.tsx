import { useMemo, useState } from 'react'
import { ApiKeySettings } from './settings/ApiKeySettings'
import { getStoredKey, setStoredKey } from './storage/keyStorage'
import { AnthropicProvider } from './llm/AnthropicProvider'
import { InterviewView } from './interview/InterviewView'
import { useInterview } from './interview/useInterview'
import { GeneratedFilesView } from './generation/GeneratedFilesView'
import { useGeneration } from './generation/useGeneration'

type View = 'interview' | 'generated'

function InterviewApp({ apiKey }: { apiKey: string }) {
  const provider = useMemo(() => new AnthropicProvider(apiKey), [apiKey])
  const interview = useInterview(provider)
  const generation = useGeneration(provider, interview.state.messages, interview.state.coverage, interview.state.decisions)
  const [view, setView] = useState<View>(generation.state.status === 'done' ? 'generated' : 'interview')

  if (view === 'generated') {
    return <GeneratedFilesView generation={generation} onBackToInterview={() => setView('interview')} />
  }

  return (
    <InterviewView
      interview={interview}
      onGenerate={() => {
        setView('generated')
        generation.generate()
      }}
    />
  )
}

function App() {
  const [apiKey, setApiKey] = useState<string | null>(() => getStoredKey())

  if (!apiKey) {
    return (
      <ApiKeySettings
        onSave={(key, remember) => {
          setStoredKey(key, remember)
          setApiKey(key)
        }}
      />
    )
  }

  return <InterviewApp apiKey={apiKey} />
}

export default App
