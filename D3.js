import * as d3 from "https://cdn.jsdelivr.net/npm/d3@6/+esm";

const censusUrl =
  "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/state/totals/NST-EST2025-ALLDATA.csv";
const placesUrl =
  "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/cities/totals/sub-est2025.csv";
const width = 1120;
const margin = { top: 40, right: 190, bottom: 20, left: 150 };
const barHeight = 25;
const numberFormat = d3.format(",");
const container = document.querySelector("#chart");
const errorMessage = document.querySelector("#error");
const downloadButton = document.querySelector("#download");
const tooltip = document.querySelector("#state-tooltip");
let chartSvg;

function showError(error) {
  errorMessage.textContent = `Unable to load or export the chart: ${error.message}`;
  errorMessage.hidden = false;
  console.error(error);
}

function showTooltip(event, stateData, cities) {
  tooltip.replaceChildren();

  const share = document.createElement("strong");
  share.className = "tooltip-share";
  share.textContent = `${d3.format(".1%")(stateData.population / stateData.totalPopulation)} of U.S. population`;
  tooltip.append(share);

  const cityHeading = document.createElement("div");
  cityHeading.className = "tooltip-cities-heading";
  cityHeading.textContent = `Largest cities/places in ${stateData.state} (2025)`;
  tooltip.append(cityHeading);

  const topCities = cities.slice(0, 5);
  const cityChartWidth = 360;
  const rowHeight = 24;
  const labelWidth = 104;
  const barX = 114;
  const barMaxWidth = 112;
  const valueX = barX + barMaxWidth + 10;
  const labelMeasureContext = document.createElement("canvas").getContext("2d");
  if (!labelMeasureContext) {
    throw new Error("The browser could not measure the city labels.");
  }
  labelMeasureContext.font = "10px Arial";
  const truncateCityName = (name) => {
    if (labelMeasureContext.measureText(name).width <= labelWidth) return name;
    let truncated = name;
    while (
      truncated.length > 0 &&
      labelMeasureContext.measureText(`${truncated}...`).width > labelWidth
    ) {
      truncated = truncated.slice(0, -1);
    }
    return `${truncated}...`;
  };
  const cityChart = d3
    .create("svg")
    .attr("class", "tooltip-city-chart")
    .attr("viewBox", `0 0 ${cityChartWidth} ${topCities.length * rowHeight}`)
    .attr("role", "img")
    .attr(
      "aria-label",
      `Five largest cities or places in ${stateData.state}, by population`,
    );
  const cityScale = d3
    .scaleLinear()
    .domain([0, d3.max(topCities, (city) => city.population) || 1])
    .range([0, barMaxWidth]);
  const cityRows = cityChart
    .selectAll("g")
    .data(topCities)
    .join("g")
    .attr("transform", (city, index) => `translate(0,${index * rowHeight})`);

  cityRows
    .append("text")
    .attr("x", 0)
    .attr("y", 16)
    .attr("font-size", 10)
    .attr("text-anchor", "start")
    .text((city) => truncateCityName(city.name));

  cityRows
    .append("rect")
    .attr("x", barX)
    .attr("y", 5)
    .attr("width", (city) => cityScale(city.population))
    .attr("height", 14)
    .attr("fill", "#d73027");

  cityRows
    .append("text")
    .attr("x", valueX)
    .attr("y", 16)
    .attr("font-size", 10)
    .attr("text-anchor", "start")
    .text((city) => numberFormat(city.population));

  tooltip.append(cityChart.node());
  tooltip.hidden = false;

  const bounds = tooltip.getBoundingClientRect();
  const pointerX = event.clientX ?? 0;
  const pointerY = event.clientY ?? 0;
  tooltip.style.left = `${Math.max(8, Math.min(pointerX + 16, window.innerWidth - bounds.width - 8))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(pointerY + 16, window.innerHeight - bounds.height - 8))}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function renderChart(data, totalPopulation, citiesByState) {
  const height =
    Math.ceil(data.length * barHeight) + margin.top + margin.bottom;
  const topStates = new Set(data.slice(0, 4).map((d) => d.state));
  const topGroupPopulation = d3.sum(data.slice(0, 4), (d) => d.population);
  let cumulativePopulation = topGroupPopulation;
  let secondGroupEnd = 4;
  let closestToTwoThirds = Math.abs(cumulativePopulation - (2 * totalPopulation) / 3);

  for (let i = 4; i < data.length - 1; i += 1) {
    cumulativePopulation += data[i].population;
    const difference = Math.abs(cumulativePopulation - (2 * totalPopulation) / 3);
    if (difference < closestToTwoThirds) {
      closestToTwoThirds = difference;
      secondGroupEnd = i + 1;
    }
  }

  const populationGroups = [
    { first: 0, last: 3 },
    { first: 4, last: secondGroupEnd - 1 },
    { first: secondGroupEnd, last: data.length - 1 },
  ].filter((group) => group.first <= group.last);
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.population)])
    .range([margin.left, width - margin.right]);
  const y = d3
    .scaleBand()
    .domain(data.map((d) => d.state))
    .range([margin.top, height - margin.bottom])
    .padding(0.1);

  const svg = d3
    .create("svg")
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr("aria-label", "2025 populations for U.S. states and the District of Columbia");

  svg
    .append("g")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("fill", (d) => (topStates.has(d.state) ? "#d73027" : "#d3d3d3"))
    .attr("x", x(0))
    .attr("y", (d) => y(d.state))
    .attr("width", (d) => x(d.population) - x(0))
    .attr("height", y.bandwidth())
    .attr("tabindex", 0)
    .attr("role", "graphics-symbol")
    .attr("aria-describedby", "state-tooltip")
    .attr(
      "aria-label",
      (d) => `${d.state}: ${numberFormat(d.population)} people, ${d3.format(".1%")(d.population / totalPopulation)} of the U.S. population`,
    )
    .on("mouseenter", function () {
      d3.select(this).attr("fill", "#008c95");
    })
    .on("mouseenter.tooltip", function (event, d) {
      showTooltip(event, { ...d, totalPopulation }, citiesByState.get(d.state) ?? []);
    })
    .on("mousemove.tooltip", function (event, d) {
      showTooltip(event, { ...d, totalPopulation }, citiesByState.get(d.state) ?? []);
    })
    .on("mouseleave", function (event, d) {
      d3.select(this).attr(
        "fill",
        topStates.has(d.state) ? "#d73027" : "#d3d3d3",
      );
    });
  svg
    .selectAll("rect")
    .on("mouseleave.tooltip", hideTooltip)
    .on("focus.tooltip", function (event, d) {
      const bounds = this.getBoundingClientRect();
      showTooltip(
        { clientX: bounds.right, clientY: bounds.top },
        { ...d, totalPopulation },
        citiesByState.get(d.state) ?? [],
      );
    })
    .on("blur.tooltip", hideTooltip);

  svg
    .append("g")
    .attr("font-family", "Arial, sans-serif")
    .attr("font-size", 12)
    .attr("font-weight", 200)
    .attr("text-anchor", "end")
    .selectAll("text")
    .data(data)
    .join("text")
    .attr("x", (d) => x(d.population))
    .attr("y", (d) => y(d.state) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("dx", -4)
    .attr("fill", (d) => (topStates.has(d.state) ? "white" : "#333"))
    .text((d) => numberFormat(d.population))
    .call((labels) =>
      labels
        .filter((d) => x(d.population) - x(0) < 300)
        .attr("dx", 4)
        .attr("fill", "black")
        .attr("text-anchor", "start"),
    );

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickSize(0).tickSizeOuter(0))
    .call((axis) =>
      axis
        .selectAll(".tick text")
        .attr("font-weight", "bold")
        .attr("font-size", 14),
    )
    .call((axis) => axis.select(".domain").remove());

  const labelMeasureContext = document.createElement("canvas").getContext("2d");
  if (!labelMeasureContext) {
    throw new Error("The browser could not measure the population labels.");
  }
  labelMeasureContext.font = "200 12px Arial";
  populationGroups.forEach((group) => {
    const firstBar = data[group.first];
    const lastBar = data[group.last];
    const bracketTop = y(firstBar.state) + y.bandwidth() / 2;
    const bracketBottom = y(lastBar.state) + y.bandwidth() / 2;
    const bracketMiddle = (bracketTop + bracketBottom) / 2;
    const groupPopulation = d3.sum(
      data.slice(group.first, group.last + 1),
      (d) => d.population,
    );
    const valueEnd = (bar) => {
      const label = svg
        .selectAll("text")
        .filter((d) => d?.state === bar.state)
        .node();
      const labelIsOutside =
        label?.getAttribute("text-anchor") === "start";
      return labelIsOutside && label
        ? x(bar.population) +
          4 +
          labelMeasureContext.measureText(numberFormat(bar.population)).width +
          0
        : x(bar.population);
    };
    const groupEnd = d3.max(
      data.slice(group.first, group.last + 1),
      valueEnd,
    );
    const bracketX = groupEnd + 25;
    const firstBarEnd = valueEnd(firstBar) + 10;
    const lastBarEnd = valueEnd(lastBar) + 10;

    svg
      .append("path")
      .attr(
        "d",
        `M${firstBarEnd},${bracketTop}H${bracketX}V${bracketBottom}H${lastBarEnd}`,
      )
      .attr("fill", "none")
      .attr("stroke", "#333")
      .attr("stroke-width", 1.5);

    svg
      .append("text")
      .attr("x", bracketX + 10)
      .attr("y", bracketMiddle - 7)
      .attr("font-family", "sans-serif")
      .attr("font-size", 14)
      .attr("font-weight", "bold")
      .call((label) => {
        label
          .append("tspan")
          .attr("x", bracketX + 10)
          .attr("font-size", 18)
          .text(
            d3.format(".1%")(groupPopulation / totalPopulation),
          );
        label
          .append("tspan")
          .attr("x", bracketX + 10)
          .attr("dy", "1.2em")
          .attr("font-size", 14)
          .text("of U.S. Population");
      });
    });

  container.replaceChildren(svg.node());
  downloadButton.disabled = false;
  return svg.node();
}

async function downloadPng(svg) {
  const dimensions = svg.viewBox.baseVal;
  const serializedSvg = new XMLSerializer().serializeToString(svg);
  const svgUrl = URL.createObjectURL(
    new Blob([serializedSvg], { type: "image/svg+xml;charset=utf-8" }),
  );

  try {
    const image = new Image();
    image.src = svgUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("The browser could not create a canvas context.");
    }
    context.drawImage(image, 0, 0);

    const png = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The browser could not create the PNG."));
      }, "image/png");
    });

    const pngUrl = URL.createObjectURL(png);
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = "state-populations.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(pngUrl), 0);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

async function loadChart() {
  const [rows, placeRows] = await Promise.all([
    d3.csv(censusUrl),
    d3.csv(placesUrl),
  ]);
  const nationalRow = rows.find((row) => row.SUMLEV === "010");
  const totalPopulation = Number(nationalRow?.POPESTIMATE2025);
  const data = rows
    .filter((row) => row.SUMLEV === "040" && row.STATE !== "72")
    .map((row) => ({
      state: row.NAME,
      population: Number(row.POPESTIMATE2025),
    }))
    .filter((d) => Number.isFinite(d.population))
    .sort((a, b) => d3.descending(a.population, b.population));

  if (data.length === 0) {
    throw new Error("The Census Bureau file contained no state population data.");
  }
  if (!Number.isFinite(totalPopulation) || totalPopulation <= 0) {
    throw new Error("The Census Bureau file contained no valid U.S. population total.");
  }

  const citiesByState = d3.group(
    placeRows
      .filter((row) => row.SUMLEV === "162" && Number.isFinite(Number(row.POPESTIMATE2025)))
      .map((row) => ({
        state: row.STNAME,
        name: row.NAME.replace(/\s+(city|town|village|borough|CDP)$/i, ""),
        population: Number(row.POPESTIMATE2025),
      }))
      .sort((a, b) => d3.descending(a.population, b.population)),
    (place) => place.state,
  );
  if (citiesByState.size === 0) {
    throw new Error("The Census Bureau file contained no place population data.");
  }

  chartSvg = renderChart(data, totalPopulation, citiesByState);
}

downloadButton.addEventListener("click", async () => {
  downloadButton.disabled = true;
  try {
    await downloadPng(chartSvg);
  } catch (error) {
    showError(error);
  } finally {
    downloadButton.disabled = false;
  }
});

loadChart().catch(showError);
