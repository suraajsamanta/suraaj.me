import { SHARE_CARDS, type ShareGame } from '../../../shared/share-metadata';

function drawIcon({ game, color, edge, ink }: { game: ShareGame; color: string; edge: string; ink: string }) {
  const outline = { stroke: ink, strokeWidth: 9, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
  const stroke = { ...outline, fill: 'none' };
  const spark = (x: number, y: number, fill = '#fff9e8') => <path key={`${x}-${y}`} transform={`translate(${x} ${y})`} d="M0 -16Q3 -3 16 0Q3 3 0 16Q-3 3 -16 0Q-3 -3 0 -16Z" fill={fill}/>;

  switch (game) {
    case 'beerio':
      return <>
        <path d="M52 207H116M43 230H111M71 254H141" stroke={edge} strokeWidth={7} strokeLinecap="round"/>
        <path d="M89 212L143 178L194 181L226 196L287 183L325 196L348 224L337 257H112Z" fill={color} {...outline}/>
        <rect x="100" y="217" width="182" height="22" rx="10" fill={edge} {...outline} strokeWidth={5}/>
        <path d="M192 200L208 163M196 171H229" {...stroke} strokeWidth={6}/>
        <circle cx="162" cy="156" r="28" fill={edge} {...outline}/>
        <path d="M142 153Q163 135 192 152L184 163H149Z" fill={ink}/>
        {[141,292].map(x=><circle key={x} cx={x} cy="254" r="27" fill={ink} stroke={color} strokeWidth={5}/>)}
        <path d="M306 197L330 204M136 193L160 190" stroke="#fff2df" strokeWidth={6} strokeLinecap="round"/>
        <path d="M288 75L334 86L325 133L277 124Z" fill={edge} {...outline} strokeWidth={5}/>
        <path d="M298 96Q303 89 313 95Q318 105 308 108M306 118H307" {...stroke} strokeWidth={4}/>
        {spark(89,136,edge)}{spark(368,184)}{spark(245,82,edge)}
      </>;
    case 'beerio-2':
      return <>
        {[-65,0,65].map((dx,i)=><path key={dx} transform={`translate(${dx} 0)`} d="M134 304L197 217M176 242L227 176" stroke={i === 1 ? '#fff9e8' : edge} strokeWidth={4} opacity={.8}/>)}
        <ellipse cx="230" cy="261" rx="123" ry="22" fill={ink} opacity={.5}/>
        <path d="M106 191L149 167L181 121L269 111L319 148L353 168L366 209L341 241H125L99 219Z" fill={color} {...outline}/>
        <path d="M181 121L269 111L311 148L158 159Z" fill="#e7f7f8" {...outline}/>
        <path d="M332 208L274 211L252 193L185 193L161 215H106L115 239L336 238L358 216Z" fill={ink}/>
        <path d="M109 182L151 176L137 193L106 196M311 165L346 174L353 189L320 188" fill={edge} stroke={ink} strokeWidth={4}/>
        {[150,316].map(x=><circle key={x} cx={x} cy="231" r="25" fill={ink} stroke={color} strokeWidth={5}/>)}
        <path d="M202 147L212 122M218 206H248" {...stroke} strokeWidth={5}/>
        <path d="M290 84Q322 25 365 54Q395 73 368 113M298 96L378 65" fill="none" stroke={edge} strokeWidth={8}/>
        {spark(80,130)}{spark(314,65)}
      </>;
    case 'boomerang':
      return <>
        <path d="M66 241C140 350 354 249 364 139M79 198C102 223 136 231 168 219M289 94C337 82 363 85 376 103" fill="none" stroke={edge} strokeWidth={7} strokeLinecap="round"/>
        <path d="M119 125C183 136 220 155 246 172C249 133 272 93 315 73C343 60 365 78 359 100C319 155 311 209 312 262C311 282 296 295 277 283C222 239 180 218 110 189C90 179 81 144 100 131Z" fill={color} {...outline}/>
        <path d="M121 149C195 163 229 182 273 220C275 152 305 115 339 93" fill="none" stroke="#fff9e8" strokeWidth={8} opacity={.7}/>
        {spark(127,79)}{spark(352,235,edge)}{spark(220,280)}
      </>;
    case 'bump-club':
      return <>
        <ellipse cx="226" cy="247" rx="155" ry="48" fill={ink} stroke={edge} strokeWidth={5}/>
        <ellipse cx="226" cy="233" rx="155" ry="48" fill={edge} {...outline}/>
        <path d="M79 237L121 221M333 250L368 233M81 258L120 263" {...stroke} strokeWidth={5}/>
        <g transform="rotate(-14 143 174)">
          <rect x="89" y="120" width="110" height="108" rx="48" fill={color} {...outline}/>
          <path d="M125 167L129 169M157 165L161 167M135 186Q143 193 150 183" {...stroke} strokeWidth={7}/>
        </g>
        <g transform="rotate(15 301 171)">
          <rect x="250" y="112" width="103" height="111" rx="43" fill="#fbadcb" {...outline}/>
          <path d="M277 161L282 162M312 163L316 162M290 188Q300 181 308 190" {...stroke} strokeWidth={7}/>
        </g>
        <path d="M214 113L229 147L257 145L237 170L248 200L216 188L190 206L195 171L173 151L202 148Z" fill="#fff9e8" stroke={ink} strokeWidth={6}/>
        {spark(83,98,edge)}{spark(343,73)}
      </>;
    case 'floor-is-trouble':
      return <>
        {[0,1,2,3].flatMap(x=>[0,1,2,3].map(y=>{
          const off = (x === 1 && y === 2) || (x === 2 && y === 3) ? 24 : 0;
          const xx = 224 + (x-y)*42, yy = 110+(x+y)*25+off;
          return <path key={`${x}:${y}`} d={`M${xx} ${yy}l39 22-39 22-39-22z`} fill={off ? ink : (x+y)%3 ? color : edge} stroke={ink} strokeWidth={5}/>;
        }))}
        <path d="M156 137Q199 59 272 102" stroke="#fff9e8" strokeWidth={5} strokeDasharray="9 9" fill="none"/>
        <rect x="194" y="83" width="67" height="62" rx="28" transform="rotate(14 226 114)" fill={edge} {...outline}/>
        <path d="M214 111H216M239 112H241M222 128Q228 132 233 128" {...stroke} strokeWidth={6}/>
        {spark(103,183,edge)}{spark(317,99)}{spark(338,214,edge)}
      </>;
    case 'simulator':
      return <>
        <path d="M81 149Q81 122 104 122H229Q252 122 252 149V213Q252 235 231 235H171L115 271L121 235H104Q81 235 81 213Z" fill={edge} {...outline}/>
        <path d="M185 94Q185 69 211 69H345Q371 69 371 94V167Q371 191 346 191H321L337 230L280 191H211Q185 191 185 165Z" fill={color} {...outline}/>
        <path d="M221 110H329M221 137H302M111 175H148M111 199H169" {...stroke} strokeWidth={7}/>
        <path d="M263 237L279 267L312 272L288 295L293 327L263 311L233 327L239 295L214 272L248 267Z" fill="#fbd77f" {...outline}/>
        {spark(117,80)}{spark(360,258,edge)}
      </>;
    case 'jeopardy':
      return <>
        <g transform="rotate(-12 170 181)">
          <rect x="109" y="95" width="143" height="181" rx="24" fill={edge} {...outline}/>
          <path d="M133 123H226M133 149H208M133 220H224M133 245H191" {...stroke} strokeWidth={6}/>
        </g>
        <g transform="rotate(12 267 181)">
          <rect x="195" y="77" width="147" height="185" rx="24" fill={color} {...outline}/>
          <path d="M244 133C243 113 287 109 293 137C298 160 269 164 269 185M268 208H269" {...stroke} strokeWidth={11}/>
        </g>
        {spark(84,197,edge)}{spark(349,79)}{spark(344,276,edge)}
      </>;
    case 'codewords':
      return <>
        <g transform="rotate(-10 226 180)">
          <rect x="90" y="67" width="273" height="234" rx="24" fill={ink} stroke={color} strokeWidth={7}/>
          {[0,1,2].flatMap(x=>[0,1,2].map(y=><rect key={`${x}:${y}`} x={109+x*79} y={87+y*67} width="70" height="52" rx="8" fill={x===2&&y===1?'#584758':(x+y)%3===0?'#faad97':(x+y)%3===1?edge:color} />))}
          <path d="M121 112H164M201 112H243M280 112H321M121 178H164M201 178H243M121 246H164M201 246H243M280 246H321" {...stroke} strokeWidth={4}/>
          <path d="M292 171L308 185M308 171L292 185" stroke="#ffe8ee" strokeWidth={5} strokeLinecap="round"/>
        </g>
        {spark(68,184,edge)}{spark(365,56)}
      </>;
    case 'inside-ranks':
      return <>
        {[0,1,2].map((n)=><g key={n} transform={`rotate(${(n-1)*5} 207 ${108+n*66})`}>
          <rect x={85+n*14} y={77+n*66} width="237" height="57" rx="15" fill={n===0?color:n===1?edge:'#f9dd9e'} {...outline}/>
          <circle cx={118+n*14} cy={105+n*66} r="13" fill={ink}/>
          <path d={`M${150+n*14} ${106+n*66}h${110-n*20}`} {...stroke} strokeWidth={6}/>
        </g>)}
        <circle cx="330" cy="219" r="51" fill="#fff0e5" {...outline}/>
        <path d="M313 204C315 187 343 185 348 201C354 217 332 221 330 231M329 244H330" {...stroke} strokeWidth={8}/>
        {spark(354,112,edge)}{spark(74,183)}
      </>;
    case 'suraaj':
      return <>
        <circle cx="224" cy="179" r="107" fill={ink} stroke={edge} strokeWidth={4}/>
        <ellipse cx="224" cy="179" rx="155" ry="57" transform="rotate(-29 224 179)" fill="none" stroke={edge} strokeWidth={4}/>
        <path d="M224 64L251 151L339 179L251 207L224 294L197 207L109 179L197 151Z" fill={color} {...outline}/>
        <path d="M224 110L237 166L293 179L237 192L224 247L211 192L155 179L211 166Z" fill="#fff9e8"/>
        <circle cx="87" cy="255" r="12" fill={color} stroke={ink} strokeWidth={4}/>
        <circle cx="341" cy="102" r="10" fill={edge} stroke={ink} strokeWidth={4}/>
        {spark(90,93,edge)}{spark(367,217)}
      </>;
    default:
      return <>
        <rect x="101" y="76" width="244" height="163" rx="24" fill={edge} {...outline}/>
        <rect x="122" y="97" width="202" height="118" rx="11" fill={ink}/>
        <path d="M194 239V264M251 239V264M172 264H275" {...stroke}/>
        <path d="M172 162H271M222 124V194M188 132L254 193M251 132L189 190" fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"/>
        <rect x="263" y="166" width="76" height="144" rx="17" transform="rotate(14 300 240)" fill={color} {...outline}/>
        <path d="M277 211L313 221M293 233L304 199M297 278H298" {...stroke} strokeWidth={7}/>
        {spark(83,103,edge)}{spark(359,120)}{spark(152,287)}
      </>;
  }
}

export function createShareCard(game: ShareGame) {
  const card = SHARE_CARDS[game];
  return <div style={{
    position: 'relative', display: 'flex', width: '100%', height: '100%', overflow: 'hidden',
    background: `linear-gradient(125deg, #0d1322 16%, ${card.ink} 100%)`,
    color: '#fff9e8', fontFamily: 'sans-serif',
  }}>
    <div style={{ position: 'absolute', inset: 19, display: 'flex', border: '1px solid #ffffff33', borderRadius: 24 }}/>
    <svg width="1200" height="630" viewBox="0 0 1200 630" style={{position:'absolute',top:0,left:0}}>
      {[80,146,212,278,344,410,476,542].map(y=><path key={y} d={`M31 ${y}H1169`} stroke="#ffffff10"/>)}
      {[80,146,212,278,344,410,476,542,608,674,740,806,872,938,1004,1070,1136].map(x=><path key={x} d={`M${x} 31V599`} stroke="#ffffff10"/>)}
      <circle cx="906" cy="311" r="225" fill={card.color} opacity=".1"/>
      <circle cx="906" cy="311" r="193" fill={card.color} opacity=".11"/>
      <circle cx="906" cy="311" r="225" stroke={card.color} strokeWidth="2" strokeDasharray="9 12" opacity=".65" fill="none"/>
      <path d="M668 311H1144M906 73V550" stroke={card.color} strokeWidth="2" opacity=".32"/>
      <g transform="translate(654 112) scale(1.12)">{drawIcon({ game, color: card.color, edge: card.secondary, ink: card.ink }).props.children}</g>
    </svg>
    <div style={{ position: 'absolute', left: 64, right: 64, top: 55, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ display:'flex', letterSpacing: '-1.4px', fontSize: 36, fontWeight: 800 }}>{game === 'suraaj' ? 'suraaj.me' : 'madfun'}<svg width="23" height="23" viewBox="0 0 24 24" style={{ marginLeft: 7, marginTop: 9 }}><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" fill="none" stroke={card.color} strokeWidth="3" strokeLinecap="round"/></svg></span>
      <span style={{ display:'flex', fontSize: 16, letterSpacing: '3px', color: card.color, border: `1px solid ${card.color}`, borderRadius: 8, padding: '8px 12px' }}>{card.meta}</span>
    </div>
    <div style={{ position: 'absolute', left: 64, top: 152, width: 635, display: 'flex', flexDirection: 'column', letterSpacing: '-5px', lineHeight: .96, fontWeight: 800, fontSize: game === 'codewords' ? 99 : 104 }}>
      {card.title.map((line,i)=><span key={line} style={{ color: i === card.title.length-1 ? card.color:'#fff9e8' }}>{line}</span>)}
    </div>
    <div style={{ position:'absolute', top:395, left:68, display:'flex', fontSize:29, color:'#f0eadc', fontWeight:500 }}>{card.copy}</div>
    <div style={{ position: 'absolute', left: 65, bottom: 57, display: 'flex', alignItems: 'center', gap: 15 }}>
      <span style={{ display:'flex', padding: '10px 14px', borderRadius: 8, background: card.color, color: '#101724', fontWeight:800, letterSpacing: '2px', fontSize:15 }}>{game === 'suraaj' ? 'PERSONAL SITE' : 'PLAY ON YOUR PHONE'}</span>
      <span style={{ display:'flex', color: '#e7e8ee', fontSize: 18 }}>{game === 'suraaj' ? 'suraaj.me' : 'suraaj.me/madfun'}</span>
    </div>
  </div>;
}
