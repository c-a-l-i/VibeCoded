import { useEffect, useState } from 'react'

const PIPS = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
}

function Die({ value, rolling, delay }) {
  return (
    <div className={`die ${rolling ? 'rolling' : ''}`} style={{ animationDelay: delay }}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[value].includes(i + 1) ? 'pip' : ''} />
      ))}
    </div>
  )
}

export default function Dice({ dice, rolling }) {
  const [faces, setFaces] = useState(dice)

  useEffect(() => {
    if (!rolling) return
    const t = setInterval(() => setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]), 80)
    return () => clearInterval(t)
  }, [rolling])

  const shown = rolling ? faces : dice
  return (
    <div className="dice">
      <Die value={shown[0]} rolling={rolling} delay="0ms" />
      <Die value={shown[1]} rolling={rolling} delay="90ms" />
    </div>
  )
}
