import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Primitives'
import { Field, Input } from '../ui/Field'
import { useSettings } from '../../hooks/useData'
import { updateSettings } from '../../db/mutations'

/**
 * First run. Deliberately short: one optional question, then out of the way.
 * The important thing it says is where the data lives, because with no account
 * behind the app the user is the only one who can protect it.
 */
export function Welcome() {
  const settings = useSettings()
  const [name, setName] = useState('')

  // Undefined means the settings row has not loaded yet -- do not flash the modal.
  const open = settings !== undefined && !settings.onboarded

  async function finish() {
    await updateSettings({ userName: name.trim(), onboarded: true })
  }

  return (
    <Modal
      open={open}
      onClose={finish}
      title="Welcome to Dompet"
      description="A financial tracker that keeps everything on this device."
      size="sm"
      footer={
        <>
          <Button onClick={finish}>Skip</Button>
          <Button variant="primary" onClick={finish}>
            Get started
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="What should we call you?" hint="Optional -- it is only shown to you.">
          {(id) => (
            <Input
              id={id}
              autoFocus
              value={name}
              placeholder="Your name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && finish()}
            />
          )}
        </Field>

        <div className="rounded-lg border border-line bg-surface2 px-3 py-2.5 text-xs leading-relaxed text-ink2">
          <p className="mb-1 font-medium text-ink">Your data stays in this browser.</p>
          <p>
            There is no account and no server. That also means clearing your browser data
            deletes it -- use <span className="font-medium text-ink">Data &rarr; Back up</span> in
            the top bar to keep a copy.
          </p>
        </div>
      </div>
    </Modal>
  )
}
