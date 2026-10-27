import { InstallGuide } from '../components/InstallGuide'
import { ComingSoon, PageHeader } from '../components/PageHeader'

export function DecksPage() {
  return (
    <>
      <PageHeader title="牌組" />
      <InstallGuide />
      <ComingSoon stage={2}>還沒有牌組。建立牌組與新增卡片的功能即將開放。</ComingSoon>
    </>
  )
}
