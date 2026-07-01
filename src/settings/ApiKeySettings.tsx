import { useState } from 'react'

interface ApiKeySettingsProps {
  onSave: (key: string, remember: boolean) => void
}

export function ApiKeySettings({ onSave }: ApiKeySettingsProps) {
  const [key, setKey] = useState('')
  const [remember, setRemember] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) return
    onSave(key.trim(), remember)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6 border rounded">
        <h1 className="text-lg font-semibold">Enter your Anthropic API key</h1>
        <p className="text-sm text-gray-500">
          Your key is stored only in your browser and is sent only to Anthropic's API.
        </p>
        <input
          type="password"
          className="w-full border rounded px-3 py-2"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-..."
          autoFocus
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember my key on this device
        </label>
        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded">
          Continue
        </button>
      </form>
    </div>
  )
}
