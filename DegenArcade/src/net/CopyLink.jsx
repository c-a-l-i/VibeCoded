import { useState } from 'react'
import { inviteLink } from './net.js'
import { t } from '../i18n/index.js'

// Copies the room's invite link, or a seat link when `seat` (a token from the host's seat links) is set.
export default function CopyLink({ code, seat = null, label = t('online.copyInvite'), className = 'btn' }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(code, seat))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      prompt(t('online.copyPrompt'), inviteLink(code, seat))
    }
  }
  return (
    <button className={className} onClick={copy}>
      {copied ? t('online.copied') : label}
    </button>
  )
}
