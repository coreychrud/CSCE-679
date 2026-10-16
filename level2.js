import * as d3 from "d3";
import { temperatureRows } from "./level1.js";

const margin = { top: 32, right: 16, bottom: 16, left: 96 };
const width = 960;
const height = 360;
const monthNames = d3.timeFormat("%B");

// Build a second year-by-month matrix, keeping every daily value in each cell.
export const data = temperatureRows.then((rows) => {
  const cells = Array.from(
    d3.rollup(
      rows,
      (values) => ({
        year: values[0].date.getFullYear(),
        month: values[0].date.getMonth(),
        values: values.sort((a, b) => d3.ascending(a.date, b.date)),
      }),
      (row) => row.date.getFullYear(),
      (row) => row.date.getMonth(),
    ),
    ([, months]) => Array.from(months.values()),
  ).flat();

  // Reserve room for the axis labels and calculate the matrix dimensions.
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Map years to columns and calendar months to rows.
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

  // Use one shared vertical temperature range inside every small multiple.
  const temperatureScale = d3
    .scaleLinear()
    .domain([
      d3.min(rows, (row) => row.min_temperature),
      d3.max(rows, (row) => row.max_temperature),
    ])
    .range([yScale.bandwidth() - 4, 4]);

  // Match level 1's red-to-blue background color mapping.
  const colorScale = d3
    .scaleSequential()
    .interpolator(d3.interpolateRdYlBu)
    .domain([
      d3.max(rows, (row) => row.max_temperature),
      d3.min(rows, (row) => row.min_temperature),
    ]);
  const dayScale = d3.scaleLinear().domain([1, 31]).range([4, xScale.bandwidth() - 4]);

  // Create the exported container and identify this second visualization.
  const container = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = "Daily Temperature Line Charts";
  container.appendChild(title);
  const controls = d3.select(container).append("div");
  const modeLabel = controls.append("label").text("Cell background: ");
  const modeButton = modeLabel
    .append("button")
    .attr("type", "button")
    .text("Maximum");

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Daily maximum and minimum temperature by year and month");
  const chart = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Create one translated SVG group for each year-month cell.
  const cellGroups = chart
    .selectAll("g.month-cell")
    .data(cells)
    .join("g")
    .attr("class", "month-cell")
    .attr(
      "transform",
      (cell) => `translate(${xScale(cell.year)},${yScale(cell.month)})`,
    );

  // Give each cell the level 1 background color based on its monthly maximum.
  const cellBackgrounds = cellGroups
    .append("rect")
    .attr("width", xScale.bandwidth())
    .attr("height", yScale.bandwidth())
    .attr("fill", (cell) => colorScale(d3.max(cell.values, (row) => row.max_temperature)))
    .attr("stroke", "#bbb");

  // Create reusable line generators for daily maximum and minimum values.
  const line = (measure) =>
    d3
      .line()
      .x((row) => dayScale(row.date.getDate()))
      .y((row) => temperatureScale(row[measure]));

  // Draw the two daily temperature lines inside each month cell.
  cellGroups
    .append("path")
    .attr("d", (cell) => line("max_temperature")(cell.values))
    .attr("fill", "none")
    .attr("stroke", "#d73027")
    .attr("stroke-width", 1.25);
  cellGroups
    .append("path")
    .attr("d", (cell) => line("min_temperature")(cell.values))
    .attr("fill", "none")
    .attr("stroke", "#4575b4")
    .attr("stroke-width", 1.25);

  // Make the cell's month and line meanings available on hover.
  cellGroups
    .append("title")
    .text(
      (cell) =>
        `${cell.year} ${monthNames(new Date(2000, cell.month, 1))}: red maximum, blue minimum`,
    );

  const updateTemperature = (measure) => {
    const showingMaximum = measure === "max_temperature";
    cellBackgrounds.attr("fill", (cell) =>
      colorScale(
        showingMaximum
          ? d3.max(cell.values, (row) => row[measure])
          : d3.min(cell.values, (row) => row[measure]),
      ),
    );
    modeButton.text(showingMaximum ? "Maximum" : "Minimum");
    svg.attr(
      "aria-label",
      `Daily maximum and minimum temperature by year and month with ${showingMaximum ? "maximum" : "minimum"} cell backgrounds`,
    );
  };

  modeButton.on("click", () => {
    const nextMeasure =
      modeButton.text() === "Maximum" ? "min_temperature" : "max_temperature";
    updateTemperature(nextMeasure);
  });

  // Add the shared year and month axes for the matrix.
  chart
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));
  chart
    .append("g")
    .call(d3.axisLeft(yScale).tickFormat((month) => monthNames(new Date(2000, month, 1))));

  // Explain which line color represents each daily temperature measure.
  const legend = d3.select(container).append("div").style("margin-top", "8px");
  legend
    .append("span")
    .style("color", "#d73027")
    .text("— Maximum temperature");
  legend
    .append("span")
    .style("color", "#4575b4")
    .text("— Minimum temperature");

  return container;
});
