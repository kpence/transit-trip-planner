import React from 'react';

/*
<Selector label='Destination Stop:'
routeNums={this.state.route_nums}
stops={TimeTable[this.state.selected_target_route_num]["stops"]}
stopChange={this.handleStopNameChange2}
routeChange={this.handleRouteNumChange2}
/>

 */

const LocationSelector = (props) => {
  return (
    <div>
      <label>{props.label}</label><br />
      <select onChange={props.routeChange}>
      {
        props.routeNums.map((route_num, index) => 
          <option key={index} value={route_num}>
          Route Number: {route_num}
          </option>
        )
      }
      </select>

      <select onChange={props.stopChange}>
      {
        props.stops.map((stop_name,index,array) =>
        (index < array.length - 1)
          ? <option key={index} value={stop_name}>
            Stop: {stop_name}
            </option>
          : <div></div>
        )
      }
      </select>
    </div>
  );
}

export default LocationSelector;
