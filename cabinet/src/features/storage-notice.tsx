import { useEffect, useState } from 'react'
import { useClub } from '../app/context'
import { Button } from '../components/shared'
export function StorageNotice() {
  const { state, tx } = useClub()
  const [notice, setNotice] = useState<{ kind: string; code: string }>()
  useEffect(() => {
    let live = true
    void import('../mocks/store').then((m) => {
      if (live) setNotice(m.getDemoStorageNotice())
    })
    return () => {
      live = false
    }
  }, [state])
  if (!notice) return null
  return (
    <aside className="storage-notice" role={notice.kind === 'recovered' ? 'status' : 'alert'}>
      <div>
        <strong>
          {notice.kind === 'recovered'
            ? tx('Демо обновлено. Данные сохранены.', 'Демо жаңартылды. Деректер сақталды.')
            : tx(
                'Изменения доступны только в этом сеансе.',
                'Өзгерістер тек осы сеанста қолжетімді.',
              )}
        </strong>
        <p>
          {notice.kind === 'recovered'
            ? tx(
                'Предыдущая версия сохранена как локальная резервная копия.',
                'Алдыңғы нұсқа жергілікті сақтық көшірме ретінде сақталды.',
              )
            : tx(
                'Сохранение браузера недоступно либо исходные данные требуют восстановления. Обновление страницы может убрать новые изменения; исходная запись защищена.',
                'Браузерде сақтау қолжетімсіз немесе бастапқы деректер қалпына келтіруді қажет етеді. Бетті жаңарту жаңа өзгерістерді жоюы мүмкін; бастапқы жазба қорғалған.',
              )}
        </p>
      </div>
      <Button
        variant="ghost"
        onClick={() => {
          setNotice(undefined)
          void import('../mocks/store').then((m) => m.clearDemoStorageNotice())
        }}
      >
        {tx('Понятно', 'Түсінікті')}
      </Button>
    </aside>
  )
}
