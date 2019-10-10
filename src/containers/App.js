import React, { Component } from 'react';
import logo from '../logo.svg';
import './App.css';
import BingMapsAPIKey from '../bingmapsapikey.js';
import TimeTable from '../timetable.js';
import StopsTable from '../stops.js';
import WalkTimeTable from '../walktimetable.js';
import LocationSelector from '../components/LocationSelector';
const rp = require('request-promise');
const $ = require('cheerio');
const fs = require('fs');

class Node {
  constructor(route_num,stop_name,bus_num,vals,lat,long,time_strings) {
    this.neighbors = [];
    this.next = null;
    this.internal_weight = null;
    this.dval = Infinity;
    this.dprev = null;
    this.visited = false;

    this.route_num = route_num;
    this.stop_name = stop_name;
    this.bus_num = bus_num;
    this.vals = vals;
    this.lat = lat;
    this.long = long;
    this.time_strings = time_strings;
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
      selected_start_dval : 420,
      route_nums : [],
      unvisited_nodes : [],
      visited_nodes : [],
      initial_node : null,
      target_node : null,
      path_results : ' ',

    };
  }


  // Converts time string from string_table into Dval (time since starting time)
  /* DONE */
  timeStringToDVal = (str) =>
  {
    if (str.charAt(0) === 'x')
      return -1;

    let time = 0;

    // If Afternoon or Midnight
    if ((str.charAt(0) === '0' && str.charAt(str.length-1) === 'P')
     || (str.charAt(0) === '1' && str.charAt(1) === '2' && str.charAt(str.length-1) === 'A'))
    {
      time += 12*60;
    }

    time += Number(str.charAt(0)) * 600;
    time += Number(str.charAt(1)) * 60;
    time += Number(str.charAt(3)) * 10;
    time += Number(str.charAt(4));
    return time;
	}

  // Set the neighbors for all the nodes
  /* DONE */
  setNeighbors()
  {
    this.state.unvisited_nodes.forEach(node => {
      node.neighbors = this.state.unvisited_nodes.filter(each => each.route_num !== node.route_num);
      node.neighbors.push(node.next);
    });
  }

  getConversionValues = () =>
  {
    const long_V_actual = -96.32062187801847;
    const lat_V_actual = 30.61080629603167;
    const long_T_actual = -96.33980696694873;
    const lat_T_actual = 30.614007275516897;
    const long_V = StopsTable["27"]["Village St"]["Longitude"];
    const lat_V = StopsTable["27"]["Village St"]["Latitude"];
    const long_T = StopsTable["27"]["Trigon"]["Longitude"];
    const lat_T = StopsTable["27"]["Trigon"]["Latitude"];

    const lat_scalar = (lat_T - lat_V) / (lat_T_actual - lat_V_actual);
    const long_scalar = (long_T - long_V) / (long_T_actual - long_V_actual);
    return [
      lat_scalar,
      lat_T - lat_T_actual * lat_scalar,
      long_scalar,
      long_T - long_T_actual * long_scalar,
    ];
  }

  localToActual = (long,lat) =>
  {
    var lat_scalar, lat_offset, long_scalar, long_offset;
    [lat_scalar,lat_offset,long_scalar,long_offset] = this.getConversionValues();
    return [(long-long_offset)/long_scalar,(lat-lat_offset)/lat_scalar];
  }

  actualToLocal = (long,lat) =>
  {
    var lat_scalar, lat_offset, long_scalar, long_offset;
    [lat_scalar,lat_offset,long_scalar,long_offset] = this.getConversionValues();
    return [long*long_scalar+long_offset,lat*lat_scalar+lat_offset];
  }

  /* DONE */
  createRoutes()
  {
    // Set route_nums in lifetime method -> didMount?
    Object.keys(TimeTable).forEach((route_num)=>this.createRoute(route_num));
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
    const table = TimeTable[route_num]["table_string"].split(' ').map((each)=>this.timeStringToDVal(each));
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

  /* DONE */
  createNode(route_num,stop_name)
  {
    /*
     * Values in Node:
     * ---SET IN HERE:
     * route_num -- route number
     * name -- stop name
     * bus_num -- number of busses on route.
     * vals -- this contains all the pick up time vals for each stop
     * lat, long -- position coordinates
     * time_strings -- vals but in string format (used for drop down menus)
     * ---SET IN createRoute():
     * internal_weight -- the weight of the internal vertex to next node
     * next -- the next internal node
     * ---SET ELSEWHERE
     * neighbors -- all nodes besides internal nodes + next node (Gets set once all nodes created)
     * dval -- tentative distance value (initially set to Infinity).
     */

    // Set Vals Table String
    const bus_num = TimeTable[route_num]["bus_num"];
    
    const stops_length = TimeTable[route_num]["stops"].length;
    const stop_index = TimeTable[route_num]["stops"].indexOf(stop_name);
    const timetable = TimeTable[route_num]["table_string"].split(' ').map((each) => this.timeStringToDVal(each));
    const vals = timetable.filter(function(value, index, Arr) {
      return index % stops_length === stop_index;
    });

    const lat = StopsTable[route_num][stop_name]["Latitude"];
    const long = StopsTable[route_num][stop_name]["Longitude"];

    const tt = TimeTable[route_num]["table_string"].split(' ');
    const time_strings = tt.filter(function(value, index, Arr) {
        return index % stops_length === stop_index;
    });

    const node = new Node(route_num,stop_name,bus_num,vals,lat,long,time_strings);
    return node;
  }

  /* DONE */
  getNode = (route_num,stop_name) =>
  {
    return this.state.unvisited_nodes
             .filter((node) => node.stop_name === stop_name
                            && node.route_num === route_num)[0];
  }

  /* DONE */
  getWalkTime = (start_node,end_node) =>
  {
    var walktime;
    if (start_node.route_num === "origin" || start_node.route_num === "destination")
    {
      var longo,lato,longd,latd;
      [longo,lato] = this.localToActual(start_node.long,start_node.lat);
      [longd,latd] = this.localToActual(end_node.long,end_node.lat);

      let body = {
        "origins": [{"latitude":lato,"longitude":longo}],
        "destinations": [{"latitude":latd,"longitude":longd}],
        "travelMode": "walking",
      };

      let body_str = JSON.stringify(body);
      const options = {
        method : "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: body_str
      };
      const url = `https://dev.virtualearth.net/REST/v1/Routes/DistanceMatrix?key=${BingMapsAPIKey}`;
      fetch(url,options)
        .then(response => response.json())
        .then(api => {
          console.log(api);
          walktime = api.resourceSets[0].resources[0].results[0].travelDuration;
        })
        .catch(err => console.log(err));
    }
    else
      walktime = WalkTimeTable[start_node.route_num][start_node.stop_name][end_node.route_num][end_node.stop_name];
    return walktime;
  }

  // Get first index number from Table String after dval
  /* TEST */
  getWaitTime(end_node, dval)
  {
    // Required Change: Make sure it includes depart time as part of the window
    return end_node.vals.find((val) => val >= dval) - dval;
  }

  // NEED TO THINK OF BETTER SOLUTION FOR WHEN NO APPROPRIATE WAIT TIME
  /* TEST */
  getWeight(start_node,end_node)
  {
    if (start_node.next === end_node)
      return start_node.internal_weight;
    else {
      const walk_time = this.getWalkTime(start_node,end_node);
      const wait_time = this.getWaitTime(end_node,start_node.dval + walk_time);

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
          this.state.unvisited_nodes.findIndex(each => each === node), 1));

    node.visited = true;

    return node;
  }

  /* DONE */
  setInitialNode(node, start_dval)
  {
    let wait_time = this.getWaitTime(node, start_dval)
    if (isNaN(wait_time))
      wait_time = 0;
    node.dval =  wait_time + start_dval;
    return node;
  }

  /* TEST */
  findPath(start_node, target_node, start_dval)
  {

    let current_node = this.setInitialNode(start_node, start_dval);

    while (!target_node.visited) {
      for (let i = 0; i < current_node.neighbors.length; i++) {
        const node = current_node.neighbors[i];

        if (node.visited)
          continue;

        const dval = current_node.dval + this.getWeight(current_node,node);

        if (dval < node.dval) {
          node.dval = dval;
          node.dprev = current_node;
        }
      }

      this.markNodeVisited(current_node);

      if (this.state.unvisited_nodes.length === 0)
        break;
      else {
        let minimum = target_node;
        for (let j = 0; j < this.state.unvisited_nodes.length; j++) {
          if (minimum.dval > this.state.unvisited_nodes[j].dval)
            minimum = this.state.unvisited_nodes[j];
        }
        current_node = minimum;
        //current_node = this.state.unvisited_nodes.reduce((acc,node)=>
          //acc.dval < node.dval ? acc : node);
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
      [longo,lato] = this.localToActual(start_node.long,start_node.lat);

      for (let end_node of this.state.unvisited_nodes)
      {
        // if !end=start, if !in map as the same but flipped edge
        if (this.compareNodes(start_node,end_node))
          continue;

        var longd,latd;
        [longd,latd] = this.localToActual(end_node.long,end_node.lat);

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


    /*
    rp(options)
      .then(function(html){
        //success!
        console.log('fdsa')
        console.log($('big > a', html).length);
        console.log($('big > a', html));
      })
      .catch(function(err){
        console.log('fail catch')
        console.log(err.message)
      });
      */
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
    /*let initial_node = this.getNode(this.state.selected_route_num,this.state.selected_stop_name);
    this.setState({initial_node : {
      //
    }});*/

  };

  handleStopNameChange = (event) => {
    this.setState({selected_stop_name : event.target.value});
  };

  handleStartTimeChange = (event) => {
    this.setState({selected_start_dval : this.timeStringToDVal(event.target.value)});
  };

  updatePathResults = (node) => {
    let end_val = node.dval - this.state.selected_start_dval;
    let path_results = "Total Estimated Travel Time: " + end_val;
    console.log(node);

    while (node.dprev !== null) {
      let prev_node = node;
      node = node.dprev;

      let total_val = prev_node.dval - this.state.selected_start_dval;
      let val = prev_node.dval - node.dval;

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
    let initial_node = this.getNode(this.state.selected_route_num,this.state.selected_stop_name);
    //let initial_node = new Node(route_num,stop_name,bus_num,vals,lat,long,time_strings);
    let target_node = this.getNode(this.state.selected_target_route_num,this.state.selected_target_stop_name);
    //let target_node = new Node(target_node_ref.route_num,stop_name,bus_num,vals,lat,long,time_strings);
    if (target_node !== null
      && typeof target_node !== 'undefined')
    {
      console.log("Finding Path....");
      let node = this.findPath(initial_node, target_node, this.state.selected_start_dval);
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

        <div className='start-time'>
          <label for='start-time'>Enter the starting time:</label><br/>
          <input name='start-time' type='time' onChange={this.handleStartTimeChange}></input>
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
            this.state.path_results.split('_').map((each)=>
            <p className='results'>{each}</p>
            )
          }
        </div>
      </div>
    );
  }
}

export default App;
