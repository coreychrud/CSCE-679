import * as d3 from "d3";

const margin = { top: 32, right: 16, bottom: 16, left: 96 };
const width = 960;
const height = 360;
const monthNames = d3.timeFormat("%B");

// Load the daily records and convert them into one summarized cell per year-month.
export const data = d3.csv("./temperature_daily.csv", d3.autoType).then((rows) => {
  const cells = Array.from(
    d3.rollup(
      rows,
      (values) => ({
        year: values[0].date.getFullYear(),
        month: values[0].date.getMonth(),
        max: d3.max(values, (row) => row.max_temperature),
        min: d3.min(values, (row) => row.min_temperature),
      }),
      (row) => row.date.getFullYear(),
      (row) => row.date.getMonth(),
    ),
    ([, months]) => Array.from(months.values()),
  ).flat();

  // Reserve space for axis labels and define the grid dimensions.
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Use years as columns and the twelve calendar months as rows.
  const xScale = d3
    .scaleBand()
    .domain(cells.map((cell) => cell.year).sort(d3.ascending))
    .range([0, innerWidth])
    .padding(0.05);
  const yScale = d3
    .scaleBand()
    .domain(d3.range(12))
    .range([0, innerHeight])
    .padding(0.05);

  // Use one shared color range so maximum and minimum views remain comparable.
  const temperatureExtent = [
    d3.min(cells, (cell) => cell.min),
    d3.max(cells, (cell) => cell.max),
  ];
  const colorScale = d3
    .scaleSequential()
    .interpolator(d3.interpolateRdYlBu)
    .domain([temperatureExtent[1], temperatureExtent[0]]);

  // Create the exported container, temperature toggle, and hover tooltip.
  const container = document.createElement("div");
  container.style.position = "relative";
  const controls = d3.select(container).append("div");
  const modeLabel = controls.append("label").text("Temperature: ");
  const modeButton = modeLabel
    .append("button")
    .attr("type", "button")
    .text("Maximum");
  const tooltip = d3
    .select(container)
    .append("div")
    .style("display", "none")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("padding", "6px 8px")
    .style("border", "1px solid #777")
    .style("border-radius", "3px")
    .style("background", "white")
    .style("font", "12px sans-serif");

  // The main SVG contains the heatmap and its axes.
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Daily temperature by year and month");
  const chart = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Draw one rectangle for each year-month cell.
  const cellsSelection = chart
    .selectAll("rect")
    .data(cells)
    .join("rect")
    .attr("x", (cell) => xScale(cell.year))
    .attr("y", (cell) => yScale(cell.month))
    .attr("width", xScale.bandwidth())
    .attr("height", yScale.bandwidth())
    .attr("fill", (cell) => colorScale(cell.max));

  // Show the selected temperature measure while the pointer is over a cell.
  cellsSelection
    .on("mouseenter", (event, cell) => {
      const [x, y] = d3.pointer(event, container);
      const measure = modeButton.text() === "Maximum" ? "max" : "min";
      const measureLabel = measure === "max" ? "Maximum" : "Minimum";
      tooltip
        .style("display", "block")
        .style("left", `${x + 12}px`)
        .style("top", `${y + 12}px`)
        .html(
          `${cell.year} ${monthNames(new Date(2000, cell.month, 1))}<br>${measureLabel}: ${cell[measure]}`,
        );
    })
    .on("mousemove", (event) => {
      const [x, y] = d3.pointer(event, container);
      tooltip.style("left", `${x + 12}px`).style("top", `${y + 12}px`);
    })
    .on("mouseleave", () => tooltip.style("display", "none"));

  // Update cell colors, button text, and accessible labels when the measure changes.
  const updateTemperature = (measure) => {
    cellsSelection.attr("fill", (cell) => colorScale(cell[measure]));
    modeButton.text(measure === "max" ? "Maximum" : "Minimum");
    legendTitle.text(`${measure === "max" ? "Maximum" : "Minimum"} temperature`);
    svg.attr(
      "aria-label",
      `${measure === "max" ? "Maximum" : "Minimum"} monthly temperature by year`,
    );
  };

  modeButton.on("click", () => {
    const nextMeasure = modeButton.text() === "Maximum" ? "min" : "max";
    updateTemperature(nextMeasure);
  });

  // Add year and month labels to the heatmap.
  chart
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));
  chart
    .append("g")
    .call(d3.axisLeft(yScale).tickFormat((month) => monthNames(new Date(2000, month, 1))));

  // Build the color legend below the chart.
  const legendWidth = 280;
  const legendHeight = 48;
  const legend = d3
    .select(container)
    .append("svg")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("display", "block")
    .style("margin-top", "12px")
    .attr("role", "img")
    .attr("aria-label", "Temperature color legend");
  const legendGroup = legend.append("g").attr("transform", "translate(8,8)");
  const legendScale = d3
    .scaleLinear()
    .domain([temperatureExtent[0], temperatureExtent[1]])
    .range([0, legendWidth - 16]);
  const gradient = legend
    .append("defs")
    .append("linearGradient")
    .attr("id", "temperature-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%");

  // Add several stops to approximate the continuous temperature color scale.
  d3.range(11).forEach((step) => {
    const value =
      temperatureExtent[0] +
      (step / 10) * (temperatureExtent[1] - temperatureExtent[0]);
    gradient
      .append("stop")
      .attr("offset", `${step * 10}%`)
      .attr("stop-color", colorScale(value));
  });
  legendGroup
    .append("rect")
    .attr("width", legendWidth - 16)
    .attr("height", 12)
    .attr("fill", "url(#temperature-gradient)");
  legendGroup
    .append("g")
    .attr("transform", "translate(0,12)")
    .call(d3.axisBottom(legendScale).ticks(5));
  const legendTitle = legendGroup
    .append("text")
    .attr("x", 0)
    .attr("y", -1)
    .style("font", "12px sans-serif")
    .text("Maximum temperature");

  return container;
});
