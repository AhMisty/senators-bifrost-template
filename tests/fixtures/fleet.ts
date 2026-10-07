export const fleetDraftBody = `
  <div id="shortcut-data"></div>
  <form action="game.php?page=fleetStep2" method="post">
    <input type="hidden" name="token" value="draft-token">
    <select name="speed"><option value="10" selected>100%</option></select>
    <select name="type"><option value="1" selected>Planet</option></select>
  </form>
  <script>
    data = {
      gamespeed: 4,
      fleetMinDuration: 5,
      maxspeed: 4000,
      fleetroom: 1000,
      planet: {galaxy: 1, system: 2, planet: 3, planet_type: 1},
      ships: {"210": {amount: 1, speed: 4000, consumption: 20}}
    };
  </script>
`

export const fleetDestinationBody = `
  <form action="game.php?page=fleetStep3" method="post">
    <input type="hidden" name="token" value="destination-token">
    <input type="radio" id="mission15" name="mission" value="15" checked>
    <label for="mission15">Expedition</label>
    <select name="staytime"><option value="1" selected>1</option></select>
  </form>
  <script>data = {fleetroom: 1000, consumption: 25};</script>
`

export const fleetDispatchBody = `
  <div class="fleettab16">
    <div class="fleetstep1-3">Mission <span class="fleetstep1-10">Expedition</span></div>
    <div class="fleetstep1-4">Arrival <span class="fleetstep1-10">01.01.2026 12:00:00</span></div>
    <div class="fleetstep1-5">Fuel <span class="fleetstep1-10">25</span></div>
    <div class="fleetstep1-5">From <span class="fleetstep1-10">[1:2:3]</span></div>
    <div class="fleetstep1-6"><span class="fleetstep1-11">4.000</span> speed</div>
    <div class="fleetstep1-7">Arrival <span class="fleetstep1-11">01.01.2026 13:00:00</span></div>
    <div class="fleetstep1-9"><span class="fleetstep1-11">42</span> distance</div>
    <div class="fleetstep1-9"><span class="fleetstep1-11">[1:2:16]</span> destination</div>
  </div>
  <div class="alleanza1">
    <img src="gebaeude/210.gif" class="fleettab13">
    <span class="fleettab14">Probe</span><span class="fleettab15">1</span>
  </div>
`

export const refusedFleetBody = '<div class="ally_contents">private-server-message</div>'

export type FleetEntry = {
  id: number | null
  mission?: string
  origin?: string
  target?: string
  departure?: string
  arrival?: string | null
  amount?: number
}

export function fleetTableBody(fleets: FleetEntry[] = []): string {
  return [
    '<form action="game.php?page=fleetStep1" method="post"></form>',
    '<table class="ally_ranks">',
    ...fleets.map(
      (fleet, index) => `<tr>
        <td>${index + 1}</td>
        <td>${fleet.mission ?? 'Expedition'}<br><a title="On the way">A</a></td>
        <td>${fleet.amount ?? 1}</td>
        <td>${fleet.origin ?? '[1:2:3]'}</td>
        <td>${fleet.departure ?? '01.01.2026 12:00:00'}</td>
        <td>${fleet.target ?? '[1:2:16]'}</td>
        <td>${fleet.arrival === null ? '-' : (fleet.arrival ?? '01.01.2026 13:00:00')}</td>
        <td>0:59:59</td>
        <td>${
          fleet.id === null
            ? '-'
            : `<form action="game.php?page=fleetTable&amp;action=sendfleetback">
                <input name="fleetID" value="${fleet.id}">
                <input type="submit" value="Recall">
              </form>`
        }</td>
      </tr>`,
    ),
    '</table>',
  ].join('')
}
