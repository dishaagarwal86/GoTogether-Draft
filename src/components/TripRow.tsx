type TripRowProps = {
  date: string
  month: string
  title: string
  meta: string
  status: string
  blue?: boolean
}

export function TripRow({ date, month, title, meta, status, blue = false }: TripRowProps) {
  return (
    <article className={`planned-card ${blue ? '' : 'featured-trip'}`}>
      <div className={`trip-date ${blue ? 'blue-date' : ''}`}>
        <strong>{date}</strong>
        <span>{month}</span>
      </div>
      <div className="planned-info">
        <div className="trip-status"><i className={blue ? 'blue-dot' : ''} />{status}</div>
        <h3>{title}</h3>
        <p>{meta}</p>
      </div>
      {blue ? <div className="trip-progress"><span>60%</span><i><b /></i></div> : <div className="friend-stack"><span>JM</span><span>SL</span><span>+2</span></div>}
      <button className="round-arrow" type="button" aria-label={`Open ${title}`}>↗</button>
    </article>
  )
}
