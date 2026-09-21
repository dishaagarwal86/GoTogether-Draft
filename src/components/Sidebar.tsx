type SidebarProps = {
  onCreate: () => void
}

export function Sidebar({ onCreate }: SidebarProps) {
  return (
    <aside className="side-column">
      <section className="contact-card reveal is-visible">
        <div className="contact-top"><span className="contact-icon">✦</span><span className="online-label"><i /> All together</span></div>
        <h2>Travel is better<br /><em>together.</em></h2>
        <p>Invite your favorite people and start planning something worth looking forward to.</p>
        <button className="invite-button" type="button" onClick={onCreate}>Invite your crew <span>→</span></button>
        <div className="contact-illustration" aria-hidden="true"><span className="sun">✳</span><span className="hill hill-one" /><span className="hill hill-two" /><span className="figure figure-one" /><span className="figure figure-two" /></div>
      </section>
      <section className="quick-card reveal is-visible">
        <div className="quick-icon">↗</div><div><p className="section-kicker">Quick start</p><h3>Build a trip room</h3><p>Bring the group chat to life.</p></div><button type="button" onClick={onCreate} aria-label="Build a trip room">+</button>
      </section>
    </aside>
  )
}
