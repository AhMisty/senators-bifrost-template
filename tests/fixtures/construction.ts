type LevelEntry = { elementId: number; level: number }

type ConstructionOptions = {
  levels: LevelEntry[]
  queue?: LevelEntry[]
}

/**
 * Render the construction catalogue and queue fields used by New-Star pages.
 *
 * 渲染 New-Star 建造页面使用的等级目录与队列字段。
 */
export function constructionBody(options: ConstructionOptions): string {
  const levels = Object.fromEntries(
    options.levels.map(({ elementId, level }) => [elementId, { level }]),
  )
  const queue = options.queue ?? []
  const rows = queue.map(
    ({ elementId, level }) =>
      `<div class="element_row" style="background:url(gebaeude/${elementId}.gif)">` +
      `<span class="onlistremov">${level}</span></div>`,
  )
  return [
    '<div class="fildes_band_text">Fields taken: <span>12</span> of <span>163</span> Free: <span>151</span></div>',
    queue.length === 0
      ? ''
      : `<div id="build_process">${rows.join('')}<div id="time" data-time="600"></div><div id="progressbar" data-time="300"></div></div>`,
    `<script>var DatatList = ${JSON.stringify(levels)};</script>`,
  ].join('')
}

type ShipyardOptions = {
  inventory: { elementId: number; count: number }[]
  queue?: { elementId: number; remaining: number }[]
}

export function shipyardBody(options: ShipyardOptions): string {
  const boxes = options.inventory.map(
    ({ elementId, count }) =>
      `<div class="build_box" id="s_${elementId}"><div class="hang4" id="val_${elementId}">(${count})</div></div>`,
  )
  const queue = options.queue ?? []
  const data =
    queue.length === 0
      ? []
      : {
          Queue: queue.map(({ elementId, remaining }) => ['Ship', remaining, 1200, elementId]),
          b_hangar_id_plus: 0,
        }
  return [
    `<div id="build_elements">${boxes.join('')}</div>`,
    '<script>var DatatList = {};</script>',
    `<script>var data = ${JSON.stringify(data)};</script>`,
  ].join('')
}
