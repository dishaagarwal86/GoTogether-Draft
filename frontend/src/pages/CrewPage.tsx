import { ContactsPanel } from '../components/ContactsPanel'
import { PageHeading } from '../components/Ui'

export function CrewPage() {
  return <section className="crew-page">
    <PageHeading eyebrow="YOUR PEOPLE" title={<>My <em>crew.</em></>} description="The people you might want beside you when the next good idea becomes a real trip." />
    <ContactsPanel />
  </section>
}
