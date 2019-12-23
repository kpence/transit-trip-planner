import React, { Component } from 'react';
import logo from '../logo.svg';
import './App.css';
import BingMapsAPIKey from '../bingmapsapikey.js';
import TimeTable from '../timetable.js';
import StopsTable from '../stops.js';
import WalkTimeTable from '../walktimetable.js';
import LocationSelector from '../components/LocationSelector';
const fs = require('fs');

// A location on Earth that contains
class Node {
  constructor(route_num,stop_name,bus_num,departure_times,lat,long,time_strings) {
    this.neighbors = [];
    this.next = null;
    this.internal_weight = null;
    this.travel_duration = Infinity;
    this.dprev = null;
    this.visited = false;

    this.route_num = route_num;
    this.stop_name = stop_name;
    this.bus_num = bus_num;
    this.departure_times = departure_times;
    this.lat = lat;
    this.long = long;
    this.time_strings = time_strings;
    this.walktime_frominitial = -1;
    this.walktime_totarget = -1;
  }
}

class App extends Component {
  constructor() {
    super();
    this.state = {
      /* references to node objects, sorted by node object's tentative D value */
      selected_route_num : "12",
      selected_stop_name : "Trigon",
      selected_target_route_num : "12",
      selected_target_stop_name : "Trigon",
      selected_origin_travel_duration : 420, // Duration in minutes
      route_nums : [],
      unvisited_nodes : [],
      visited_nodes : [],
      origin_node : null,
      target_node : null,
      path_results : ' ',

    };
  }


  // Converts time string from string_table into Dval (time since starting time)
  /* DONE */
  getTravelDurationFromTimeString = (str) =>
  {
    if (str.charAt(0) === 'x')
      return -1;

    let td = 0; // travel duration

    // If Afternoon or Midnight
    if ((str.charAt(0) === '0' && str.charAt(str.length-1) === 'P')
     || (str.charAt(0) === '1' && str.charAt(1) === '2' && str.charAt(str.length-1) === 'A'))
    {
      td += 12*60; // Add time from first half of day
    }

    td += Number(str.charAt(0)) * 600;
    td += Number(str.charAt(1)) * 60;
    td += Number(str.charAt(3)) * 10;
    td += Number(str.charAt(4));
    return td; // return travel duration
	}

  // Set the neighbors for all the nodes
  /* DONE */
  setNeighbors()
  {
    this.state.unvisited_nodes.forEach(node => {
      if (node.route_num === "origin")
        console.log("FDSAFDSAFDS----ORIGIn");
      if (node.route_num === "destination")
        console.log("FDSAFDSAFDS----DESTINATIONkb");
      node.neighbors = this.state.unvisited_nodes.filter(n => n.route_num !== node.route_num);
      node.neighbors.push(node.next);
    });
  }

  getCoordConversionValues = () =>
  {
    const long_V_actual = -96.32062187801847;
    const lat_V_actual = 30.61080629603167;
    const long_T_actual = -96.33980696694873;
    const lat_T_actual = 30.614007275516897;
    const long_V = StopsTable["27"]["Village St"]["Longitude"];
    const lat_V = StopsTable["27"]["Village St"]["Latitude"];
    const long_T = StopsTable["27"]["Trigon"]["Longitude"];
    const lat_T = StopsTable["27"]["Trigon"]["Latitude"];

    // Calculate scalar matrix and offset matrix
    const lat_scalar = (lat_T - lat_V) / (lat_T_actual - lat_V_actual);
    const long_scalar = (long_T - long_V) / (long_T_actual - long_V_actual);

    const lat_offset = lat_T - lat_T_actual * lat_scalar;
    const long_offset = long_T - long_T_actual * long_scalar;
    return [
      lat_scalar,
      lat_offset,
      long_scalar,
      long_offset,
    ];
  }

  convertLocalToActual = (long,lat) =>
  {
    var lat_scalar, lat_offset, long_scalar, long_offset;
    [lat_scalar,lat_offset,long_scalar,long_offset] = this.getCoordConversionValues();
    return [(long-long_offset)/long_scalar,(lat-lat_offset)/lat_scalar];
  }

  convertActualToLocal = (long,lat) =>
  {
    var lat_scalar, lat_offset, long_scalar, long_offset;
    [lat_scalar,lat_offset,long_scalar,long_offset] = this.getCoordConversionValues();
    return [long*long_scalar+long_offset,lat*lat_scalar+lat_offset];
  }

  /* TODO */
  createRoutes()
  {
    // CONSIDER: Set route_nums in lifetime method -> didMount?

    // Call createRoute for each route (which is found in TimeTable)
    Object.keys(TimeTable).forEach(route_num=>this.createRoute(route_num));

    // Create intiial and destination nodes
    let origin_node = this.createNode(this.state.selected_route_num,this.state.selected_stop_name);
    origin_node.route_num = "origin";
    let target_node = this.createNode(this.state.selected_target_route_num,this.state.selected_target_stop_name);
    target_node.route_num = "destination";

    // Chain the API calls to find the walk times for the origin and destination nodes
    // TODO : Get walktime from each node to the initial and target nodes, chain the API calls
    let unvisited_nodes = this.state.unvisited_nodes;
    let body_list = [];
    var longo,lato,longd,latd;
    [longo,lato] = this.convertLocalToActual(origin_node.long,origin_node.lat);
    [longd,latd] = this.convertLocalToActual(target_node.long,target_node.lat);

    for (let node of this.state.unvisited_nodes)
    {
      var long,lat;
      [long,lat] = this.convertLocalToActual(node.long,node.lat);

      // Add to POST body
      body_list.push(`wp.0=${lato},${longo}&wp.1=${lat},${long}`);
      body_list.push(`wp.0=${lat},${long}&wp.1=${latd},${longd}`);
    }
    body_list.push(`wp.0=${lato},${longo}&wp.1=${latd},${longd}`);

    function fetchRequest(i) {
      if (i >= body_list.length) {
        return (0);
      }

      let ix = (i%2 === 1) ? (i-1)/2 : i/2;
      let url = `http://dev.virtualearth.net/REST/v1/Routes/Walking?${body_list[i]}&optmz=distance&key=${BingMapsAPIKey}`;
      //let url = `http://dev.virtualearth.net/REST/V1/Routes/Walking?wp.0=47.610,-122.107&wp.1=47.611,-122.104&optmz=distance&key=${BingMapsAPIKey}`;


      fetch(url)
        .then(response => response.json())
        .then(api => {
          console.log(api);
          const time = Math.round(api.resourceSets[0].resources[0].travelDuration / 60);
          if (i === body_list.length - 1) {
            origin_node.walktime_totarget = time;
            origin_node.walktime_frominitial = 0;
            target_node.walktime_totarget = 0;
            target_node.walktime_frominitial = time;
            unvisited_nodes.push(origin_node);
            unvisited_nodes.push(target_node);
            console.log("Finished getting walking times for origin and destinations.");
          }
          else {
            if (i%2 === 1)
              unvisited_nodes[ix].walktime_totarget = time;
            else
              unvisited_nodes[ix].walktime_frominitial = time;
          }
        })
        .then((a) => fetchRequest(i+1))
        .catch(err => console.log(err));
    }
    fetchRequest(0);
    console.log("--fetchrequests finished--.");

    // Add initial and target nodes to nodes list AFTER calculating walk times.

    this.setNeighbors();
  }

  /* DONE */
  createRoute(route_num)
  {
    /*
     * What does this do:
     *
     *     > Create Nodes
     *     > Put into Unvisisted Nodes
     *     > Set Next
     *     list = TimeTable[route_num]["stops"];
     *     first_node = null;
     *     For each stop in list besides last one
     *       node = createNode(route_num,stop);
     *       (insert node into unvisited nodes)
     *       if (first_node is null) then first_node = node;
     *       if (prevnode isn't null) then prevnode.next = node;
     *       prevnode = node;
     *     node.next = first_node;
     *
     *
     *      > Set Internal Weights
     *        counter = 0;
     *        for (i is 0 to length)
     *           index = counter*length + i
     *           if (converted string to value at index == -1)
     *             counter++;
     *             i = 0;
     *
     *      for each node besides last (iterator I):
     *          node.internalWeight = convert(table_string.split(' ')[I+counter*length + 1])
     *                              - convert(table_string.split(' ')[I+counter*length])
     *  
     *      
     */

    const stop_list = TimeTable[route_num]["stops"];
    let first_node = null;
    let prev_node = null;
    var node;

    // Prepare Internal Implicit Vertices
    const table = this.getTravelDurationsFromRouteNum(route_num);
    let counter = 0;
    for (let i = 0; i < stop_list.length; i++) {
      let index = counter * stop_list.length + i;
      if (table[index] === -1) {
        counter++;
        i = -1;
      }
    }

    // Create Nodes
    // Set Node.next
    // Set Node.internalWeight
    // Push to unvisited_nodes
    for (let i = 0; i < stop_list.length - 1; i++) {
      node = this.createNode(route_num,stop_list[i]);
      node.internal_weight = table[i + counter*stop_list.length + 1]
                          - table[i + counter*stop_list.length];
      //this.setState({unvisited_nodes : this.state.unvisited_nodes.concat(node)});
      this.state.unvisited_nodes.push(node);
      if (first_node === null)
        first_node = node;
      if (prev_node !== null)
        prev_node.next = node;
      prev_node = node;
    }
    node.next = first_node;

  }

  getTravelDurationsFromRouteNum = (route_num) => {
    TimeTable[route_num]["table_string"].split(' ').map(str => this.getTravelDurationFromTimeString(str));
  }

  /* DONE */
  createNode(route_num,stop_name)
  {
    /*
     * Values in Node:
     * ---SET IN HERE:
     * route_num -- route number
     * name -- stop name
     * bus_num -- number of busses on route.
     * departure_times -- this contains all the pick up time vals for each stop
     * lat, long -- position coordinates
     * time_strings -- departure_times but in string format (used for drop down menus)
     * ---SET IN createRoute():
     * internal_weight -- the weight of the internal vertex to next node
     * next -- the next internal node
     * ---SET ELSEWHERE
     * neighbors -- all nodes besides internal nodes + next node (Gets set once all nodes created)
     * travel_duration -- tentative distance value (initially set to Infinity).
     */

    // Set Vals Table String
    const bus_num = TimeTable[route_num]["bus_num"];
    
    const stops_count = TimeTable[route_num]["stops"].length;
    const stop_index = TimeTable[route_num]["stops"].indexOf(stop_name);
    const route_times = this.getTravelDurationsFromRouteNum(route_num);
    const departure_times = route_times.filter(function(value, index, Arr) {
      return index % stops_count === stop_index;
    });

    const lat = StopsTable[route_num][stop_name]["Latitude"];
    const long = StopsTable[route_num][stop_name]["Longitude"];

    const strs = TimeTable[route_num]["table_string"].split(' ');
    const time_strings = strs.filter(function(value, index, Arr) {
        return index % stops_count === stop_index;
    });

    const node = new Node(route_num,stop_name,bus_num,departure_times,lat,long,time_strings);
    return node;
  }

  /* DONE */
  getNode = (route_num,stop_name) =>
  {
    return this.state.unvisited_nodes
             .filter(node => node.stop_name === stop_name
                          && node.route_num === route_num)[0];
  }

  /* TODO */
  getWalkTime = (start_node,end_node) =>
  {
    var walktime;

    // If backwards (invalid order), then return an arbitrarily high walk time
    if (end_node.route_num === "origin" || start_node.route_num === "destination")
    {
      walktime = 99999;
    }
    //else if (start_node.route_num === "origin" && end_node.walktime_frominitial !== -1)
    else if (end_node.route_num === "destination")
    {
      walktime = end_node.walktime_frominitial;
    }
    //else if (end_node.route_num === "destination" && start_node.walktime_totarget !== -1)
    else if (end_node.route_num === "destination")
    {
      walktime = start_node.walktime_totarget;
    }
    //}
    // For every other walktime, pull value from the pre-execution-built WalkTimeTable
    else
    {
      walktime = WalkTimeTable[start_node.route_num][start_node.stop_name][end_node.route_num][end_node.stop_name];
    }

    return walktime;
  }

  // Get time spent waiting at bus stop (Get first index number from Table String after travel_duration)
  /* TEST */
  getWaitTime(end_node, travel_duration)
  {
    // Required Change: Make sure it includes depart time as part of the window
    return end_node.departure_times.find(time => time >= travel_duration) - travel_duration;
  }

  // NEED TO THINK OF BETTER SOLUTION FOR WHEN NO APPROPRIATE WAIT TIME
  /* TEST */
  getTravelDurationBetweenNodes(start_node,end_node)
  {
    if (start_node.next === end_node)
      return start_node.internal_weight;
    else {
      const walk_time = this.getWalkTime(start_node,end_node);
      const wait_time = this.getWaitTime(end_node,start_node.travel_duration + walk_time);

      if (isNaN(wait_time))
        return walk_time;

      return walk_time + wait_time;
    }
  }

  /* DONE */
  markNodeVisited(node)
  {
    this.state.visited_nodes.push(
      this.state.unvisited_nodes.splice(
          this.state.unvisited_nodes.findIndex(n => n === node), 1));

    node.visited = true;

    return node;
  }

  /* DONE */
  setOriginNode(node, origin_travel_duration)
  {
    let wait_time = this.getWaitTime(node, origin_travel_duration)
    if (isNaN(wait_time))
      wait_time = 0;
    node.travel_duration =  wait_time + travel_duration;
    return node;
  }

  /* TEST */
  findPath(start_node, target_node, origin_travel_duration)
  {

    let current_node = this.setOriginNode(start_node, origin_travel_duration);

    while (!target_node.visited) {
      for (let i = 0; i < current_node.neighbors.length; i++) {
        const node = current_node.neighbors[i];
        console.log(node);

        if (node.visited)
          continue;

        const td = current_node.travel_duration + this.getTravelDurationBetweenNodes(current_node,node);

        if (td < node.travel_duration) {
          node.travel_duration = td;
          node.dprev = current_node;
        }
      }

      this.markNodeVisited(current_node);

      if (this.state.unvisited_nodes.length === 0)
        break;
      else {
        let minimum = target_node;
        for (let j = 0; j < this.state.unvisited_nodes.length; j++) {
          if (minimum.travel_duration > this.state.unvisited_nodes[j].travel_duration)
            minimum = this.state.unvisited_nodes[j];
        }
        current_node = minimum;
        //current_node = this.state.unvisited_nodes.reduce((acc,node)=>
          //acc.travel_duration < node.travel_duration ? acc : node);
      }

    }

    return target_node;

  }


  compareNodes = (n,m) => {
    if (n.route_num === m.route_num && n.stop_name === m.stop_name)
      return true;
    return false;
  }


  buildWalkingDistanceMatrix = () => {
    this.state.unvisited_nodes = [];
    this.createRoutes();

    let result_json = {};
    Object.keys(TimeTable).forEach(num => {
        result_json[num] = {};
      Object.keys(StopsTable[num]).forEach(stop => {
        result_json[num][stop] = {};
        Object.keys(TimeTable).forEach(num2 => {
          result_json[num][stop][num2] = {};
        });
      });
    });

    console.log(result_json);

    let walktime = 0;
    let body_list = [];
    
    const countPerReq = 25;

    let edges = [];

    for (let start_node of this.state.unvisited_nodes)
    {
      var longo,lato;
      [longo,lato] = this.convertLocalToActual(start_node.long,start_node.lat);

      for (let end_node of this.state.unvisited_nodes)
      {
        // if !end=start, if !in map as the same but flipped edge
        if (this.compareNodes(start_node,end_node))
          continue;

        var longd,latd;
        [longd,latd] = this.convertLocalToActual(end_node.long,end_node.lat);

        // Add to POST body
        body_list.push({
          "origins": [{"latitude":lato,"longitude":longo}],
          "destinations": [{"latitude":latd,"longitude":longd}],
          "travelMode": "walking",
        });

        edges.push([start_node,end_node]);

      }
    }

    const url = `https://dev.virtualearth.net/REST/v1/Routes/DistanceMatrix?key=${BingMapsAPIKey}`;

    function fetchRequest(i) {
      if (i >= body_list.length) {
        console.log("FINISHED",JSON.stringify(result_json));
        return (0);
      }
      let body_str = JSON.stringify(body_list[i]);
      const options = {
        method : "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: body_str
      };
      fetch(url,options)
        .then(response => response.json())
        .then(api => {
          console.log(api);
          const o = edges[i][0];
          const d = edges[i][1];
          const time = api.resourceSets[0].resources[0].results[0].travelDuration;
          result_json[o.route_num][o.stop_name][d.route_num][d.stop_name] = time;
        })
        .then((a) => fetchRequest(i+1))
        .catch(err => console.log(err));
    }
    fetchRequest(0);

  }


  componentDidMount() {
    this.setState({route_nums : Object.keys(TimeTable)});
    this.createRoutes();

    // Create API request for every unique non-directional edge between bus stops, store json in file
    //this.buildWalkingDistanceMatrix('');
    
    console.log('debug begin')
    var options = {
      uri: 'https://transport.tamu.edu/busroutes/Routes.aspx?r=01',
      headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, Content-Type, X-Auth-Token',
      },
      transform: function (body) {
        return $.load(body);
      }

    };


  }

  handleRouteNumChange2 = (event) => {
    this.setState({selected_target_stop_name : TimeTable[event.target.value]['stops'][0]});
    this.setState({selected_target_route_num : event.target.value});
  };

  handleStopNameChange2 = (event) => {
    this.setState({selected_target_stop_name : event.target.value});
  };

  handleRouteNumChange = (event) => {
    this.setState({selected_stop_name : TimeTable[event.target.value]['stops'][0]});
    this.setState({selected_route_num : event.target.value});
    // Set the inital_node's values here
    /*let origin_node = this.getNode(this.state.selected_route_num,this.state.selected_stop_name);
    this.setState({origin_node : {
      //
    }});*/

  };

  handleStopNameChange = (event) => {
    this.setState({selected_stop_name : event.target.value});
  };

  handleStartTimeChange = (event) => {
    const origin_route_num = event.target.value;
    const origin_travel_duration = this.getTravelDurationFromTimeString(origin_route_num);
    this.setState({selected_origin_travel_duration : origin_travel_duration});
  };

  updatePathResults = (node) => {
    let end_val = node.travel_duration - this.state.selected_origin_travel_duration;
    let path_results = "Total Estimated Travel Time: " + end_val;
    console.log(node);

    while (node.dprev !== null) {
      let prev_node = node;
      node = node.dprev;

      let total_val = prev_node.travel_duration - this.state.selected_origin_travel_duration;
      let val = prev_node.travel_duration - node.travel_duration;

      let str = "";
      if (prev_node.route_num !== node.route_num) {
        let walktime = this.getWalkTime(node,prev_node);
        str += `Walk from "${node.route_num} ${node.stop_name}" to "${prev_node.route_num} ${prev_node.stop_name}", Travel Duration: ${walktime} _`;
        str += `Wait for Bus to Arrive at "${prev_node.route_num} ${prev_node.stop_name}", Duration: ${val - walktime} _`;
      }
      else {
        str += `Ride bus from "${node.route_num} ${node.stop_name}" to "${prev_node.route_num} ${prev_node.stop_name}", Travel Duration: ${val} _`;
      }
      path_results = str + path_results;
    }
    path_results = " _ " + path_results + " _ Destination reached";
    this.setState({ path_results:  path_results});
  }

  handleButtonPress = () => {
    console.log("Creating Routes....");
    this.state.unvisited_nodes = [];
    this.state.visited_nodes = [];
    this.createRoutes();
    console.log("Getting Initial and Target Nodes....");
    let origin_node = this.getNode("origin",this.state.selected_stop_name);
    //let origin_node = new Node(route_num,stop_name,bus_num,departure_times,lat,long,time_strings);
    let target_node = this.getNode("destination",this.state.selected_target_stop_name);
    //let target_node = new Node(target_node_ref.route_num,stop_name,bus_num,departure_times,lat,long,time_strings);
    if (target_node !== null
      && typeof target_node !== 'undefined')
    {
      console.log("Finding Path....");
      let node = this.findPath(origin_node, target_node, this.state.selected_origin_travel_duration);
      this.updatePathResults(node);
    }
    else {
      this.setState({ path_results:  ' '});
    }
  };

  render() {
    return (
      <div className='App'>
        <div className='top-text'>
          <p>Information pulled from: <a href='https://transport.tamu.edu/busroutes/'>Texas A&M Transport Services Bus Routes Web Page</a>.</p>
	        <p>Repository (and README) can be found here: <a href='https://github.com/kpence/transit-trip-planner'>https://github.com/kpence/transit-trip-planner</a>.</p>
        </div>

        <br/>
        <br/>

        <div className='origin-time'>
          <label for='origin-time'>Enter the starting time:</label><br/>
          <input name='origin-time' type='time' onChange={this.handleStartTimeChange}></input>
        </div>

        <div className='container'>
          <LocationSelector label='Starting Location: '
            routeNums={this.state.route_nums}
            stops={TimeTable[this.state.selected_route_num]['stops']}
            stopChange={this.handleStopNameChange}
            routeChange={this.handleRouteNumChange}
          />

          <LocationSelector label='Destination Stop: '
            routeNums={this.state.route_nums}
            stops={TimeTable[this.state.selected_target_route_num]['stops']}
            stopChange={this.handleStopNameChange2}
            routeChange={this.handleRouteNumChange2}
          />
        </div>


        <div className='btn-container'>
          <input className='btn' type='button' onClick={this.handleButtonPress} value='Plan my route' />
        </div>

        <div>
          {
            this.state.path_results.split('_').map(each=>
            <p className='results'>{each}</p>
            )
          }
        </div>
      </div>
    );
  }
}

export default App;
