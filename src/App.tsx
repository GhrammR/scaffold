import { useMemo, useState } from 'react'
import { ApiKeySettings } from './settings/ApiKeySettings'
import { getStoredKey, setStoredKey } from './storage/keyStorage'
import { AnthropicProvider } from './llm/AnthropicProvider'
import { InterviewView } from './interview/InterviewView'
import { useInterview } from './interview/useInterview'

function InterviewApp({ apiKey }: { apiKey: string }) {
  const provider = useMemo(() => new AnthropicProvider(apiKey), [apiKey])
  const interview = useInterview(provider)
  return <InterviewView interview={interview} />
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
