import { Link } from 'react-router-dom'
import { Icon } from './Ui'

export function SoloOverview({ roomId, ready, hasPlan, edit, openOptions, openPlan, openIdeas }: { roomId: string; ready: boolean; hasPlan: boolean; edit: () => void; openOptions: () => void; openPlan: () => void; openIdeas: () => void }) {
  return <div className="solo-overview">
    <div className="group-gather-main"><p className="eyebrow">NO RUSH. NO ROLL CALL. JUST YOU.</p><h2>A little freedom.<br /><em>A lot of possibility.</em></h2><p>{ready ? 'Your travel style is here. Explore the possibilities, choose a starting point, and leave room for the things you discover along the way.' : 'Start with a few things you love. We’ll find a starting itinerary you can shape around your own rhythm.'}</p>
      <div className="group-next-actions"><button className="primary-button" onClick={ready ? hasPlan ? openPlan : openOptions : edit}>{ready ? hasPlan ? 'Continue my itinerary' : 'Explore my options' : 'Share my travel style'}<Icon /></button>{ready && <button className="secondary-button" onClick={edit}>Review my preferences<Icon name="sliders" size={16} /></button>}</div>
      <div className="group-while-waiting"><Icon name="camera" size={26} /><div><h3>Follow a little curiosity.</h3><p>Save a place, collect a must-do, or take a different direction.</p><button onClick={openIdeas}>Open saved ideas ↗</button><Link to={`/explore?roomId=${encodeURIComponent(roomId)}`}>Browse all itineraries ↗</Link></div></div>
    </div><aside className="solo-postcard"><Icon name="plane" size={42} /><p className="eyebrow">A POSTCARD TO YOUR FUTURE SELF</p><h3>Somewhere new.<br /><em>Entirely your way.</em></h3><p>Your itinerary stays editable.<br />Your Companion is there when you need ideas.<br />Your own pace is the right pace.</p><span><Icon name="compass" size={17} /> ONE TRAVELLER. ALL THE POSSIBILITIES.</span></aside>
  </div>
}
