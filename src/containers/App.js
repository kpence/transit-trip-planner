import React, { Component } from 'react';
import logo from '../logo.svg';
import './App.css';
import TimeTable from '../timetable.js'
import StopsTable from '../stops.js'

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
      path_results : 0
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
  setAllNeighbors()
  {
    this.state.unvisited_nodes.forEach((node) => {
      node.neighbors = this.state.unvisited_nodes.filter((each)=> (each.route_num !== node.route_num));
      node.neighbors.push(node.next);
    });
  }

  /* DONE */
  createRoutes()
  {
    // Set route_nums in lifetime method -> didMount?
    Object.keys(TimeTable).forEach((route_num)=>this.createRoute(route_num));
    this.setAllNeighbors();
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

  /* TEST */
  getWalkTime(start_node,end_node)
  {
    const cnst = (0.0119617225 * 3.27272727);
    const walktime = cnst * Math.sqrt((start_node.long - end_node.long)**2 + (start_node.lat - end_node.lat)**2);
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

    return target_node.dval;

  }


  componentDidMount() {
    this.setState({route_nums : Object.keys(TimeTable)});
  }

  handleRouteNumChange2 = (event) => {
    this.setState({selected_target_route_num : event.target.value});
  };

  handleStopNameChange2 = (event) => {
    this.setState({selected_target_stop_name : event.target.value});
  };

  handleRouteNumChange = (event) => {
    this.setState({selected_route_num : event.target.value});
    this.setState({initial_node : null});
  };

  handleStopNameChange = (event) => {
    this.setState({selected_stop_name : event.target.value});
  };

  handleStartTimeChange = (event) => {
    this.setState({selected_start_dval : this.timeStringToDVal(event.target.value)});
  };

  handleButtonPress = () => {
    console.log("Creating Routes....");
    this.state.unvisited_nodes = [];
    this.state.visited_nodes = [];
    this.createRoutes();
    console.log("Getting Initial and Target Nodes....");
    let initial_node = this.getNode(this.state.selected_target_route_num,this.state.selected_target_stop_name);
    let target_node = this.getNode(this.state.selected_target_route_num,this.state.selected_target_stop_name);
    if (target_node !== null
      && typeof target_node !== 'undefined')
    {
      console.log("Finding Path....");
      let val = this.findPath(initial_node, target_node, this.state.selected_start_dval);
      this.setState({ path_results:  val - this.state.selected_start_dval });
      console.log("button press", val);
    }
  };

  render() {
    return (
      <div className="App">
        <div className="tmp1">
          Information pulled from: <a href="https://transport.tamu.edu/busroutes/">Texas A&M Transport Services Bus Routes Web Page</a>.
        </div>
        <div>
          <label for='start-time'>Enter the starting time:</label>
          <input name='start-time' type='time' onChange={this.handleStartTimeChange}></input>
        </div>

        <div>
          <select onChange={this.handleRouteNumChange}>
          {
            this.state.route_nums.map((route_num, index) => 
              <option key={index} value={route_num}>
              Route: {route_num}
              </option>
            )
          }
          </select>

          <select onChange={this.handleStopNameChange}>
          {
            TimeTable[this.state.selected_route_num]["stops"].map((stop_name,index,array) =>
            (index < array.length - 1)
              ? <option key={index} value={stop_name}>
                Stop: {stop_name}
                </option>
              : <div></div>
            )
          }
          </select>
        </div>

        <div>
          <select onChange={this.handleRouteNumChange2}>
          {
            this.state.route_nums.map((route_num, index) => 
              <option key={index} value={route_num}>
              Route: {route_num}
              </option>
            )
          }
          </select>

          <select onChange={this.handleStopNameChange2}>
          {
            TimeTable[this.state.selected_target_route_num]["stops"].map((stop_name,index,array) =>
            (index < array.length - 1)
              ? <option key={index} value={stop_name}>
                Stop: {stop_name}
                </option>
              : <div></div>
            )
          }
          </select>
        </div>

        <input type='button' onClick={this.handleButtonPress} value='Find Route' />

        <div className='results_panel'>
          Estimated Travel Time: {this.state.path_results}
        </div>
        <div className="results_panel2">
          {this.state.selected_route_num} {this.state.selected_stop_name}<br/>
          {this.state.selected_target_route_num} {this.state.selected_target_stop_name}<br/>
          {this.state.selected_start_dval} 
        </div>
      </div>
    );
  }
}

export default App;
