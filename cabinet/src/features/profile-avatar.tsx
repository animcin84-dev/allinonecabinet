import { useEffect, useState } from 'react'
import { useClub } from '../app/context'
import type { LocalAttachment } from '../domain/types'
import { Button, InlineError } from '../components/shared'
import { LocalFilePicker } from '../components/ui/local-files'
import { MemberAvatar } from '../components/ui/member-avatar'
import { getLocalFileInfo } from '../services/local-files'

export function ProfileAvatarEditor() {
  const { actor, act, pending, tx, toast } = useClub()
  const [current, setCurrent] = useState<LocalAttachment[]>([])
  const [draft, setDraft] = useState<LocalAttachment[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  useEffect(() => {
    let live = true
    setDraft(null)
    setError(null)
    setCurrent([])
    if (actor?.avatarId) {
      void getLocalFileInfo(actor.avatarId)
        .then((info) => {
          if (live && info) setCurrent([info])
        })
        .catch(() => {
          if (live)
            setError(
              new Error(tx('Не удалось открыть локальное фото.', 'Жергілікті фото ашылмады.')),
            )
        })
    }
    return () => {
      live = false
    }
  }, [actor?.id, actor?.avatarId])
  async function save() {
    if (!draft || pending || busy) return
    setError(null)
    try {
      await act({ type: 'profile', payload: { avatarId: draft[0]?.id ?? '' } })
      toast(tx('Фото профиля сохранено в этом браузере', 'Профиль фотосы осы браузерде сақталды'))
      setDraft(null)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason
          : new Error(tx('Не удалось сохранить фото.', 'Фото сақталмады.')),
      )
    }
  }
  return (
    <section className="profile-avatar-editor" aria-label={tx('Фото профиля', 'Профиль фотосы')}>
      <div className="row">
        <MemberAvatar
          fileId={(draft ?? current)[0]?.id ?? (draft ? undefined : actor?.avatarId)}
          name={actor?.name ?? 'Allinone'}
        />
        <div>
          <h3>{tx('Фото профиля', 'Профиль фотосы')}</h3>
          <p className="fine-print">
            {tx(
              'Локальное демо · фотография хранится только в этом браузере.',
              'Жергілікті демо · фото тек осы браузерде сақталады.',
            )}
          </p>
        </div>
      </div>
      <LocalFilePicker
        value={draft ?? current}
        onChange={setDraft}
        kind="avatar"
        multiple={false}
        disabled={pending}
        onBusyChange={setBusy}
      />
      {error && <InlineError error={error} />}
      {draft !== null && (
        <div className="row">
          <Button onClick={() => void save()} loading={pending} disabled={busy}>
            {tx('Сохранить фото', 'Фотоны сақтау')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(null)
              setError(null)
            }}
            disabled={pending}
          >
            {tx('Отменить', 'Бас тарту')}
          </Button>
        </div>
      )}
      {actor?.avatarId && !current.length && draft === null && (
        <Button variant="ghost" onClick={() => setDraft([])} disabled={pending}>
          {tx('Убрать недоступное фото', 'Қолжетімсіз фотоны алып тастау')}
        </Button>
      )}
    </section>
  )
}
