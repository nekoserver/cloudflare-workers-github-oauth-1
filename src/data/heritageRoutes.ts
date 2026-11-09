// Canonical routes owned by the world-heritage Worker.
export const HERITAGE_ROUTES = [
  {
    "method": "GET",
    "path": "/api/aichat/check-heritage-questions"
  },
  {
    "method": "POST",
    "path": "/api/aichat/check-heritage-mitokoro-gemma-batch"
  },
  {
    "method": "POST",
    "path": "/api/aichat/check-heritage-mitokoro-llama-batch"
  },
  {
    "method": "POST",
    "path": "/api/aichat/check-heritage-questions-batch"
  },
  {
    "method": "GET",
    "path": "/api/aichat/heritage-keywords-check"
  },
  {
    "method": "GET",
    "path": "/api/aichat/heritage-search-keywords-check"
  },
  {
    "method": "GET",
    "path": "/api/aichat/heritage-search-keyword-counts"
  },
  {
    "method": "GET",
    "path": "/api/aichat/heritage-mitokoro-keyword-hits"
  },
  {
    "method": "GET",
    "path": "/webgl-heritage"
  },
  {
    "method": "GET",
    "path": "/heritage-journey"
  },
  {
    "method": "POST",
    "path": "/api/settings/heritage-tour-country-filter"
  },
  {
    "method": "POST",
    "path": "/api/heritage-area-boxes"
  },
  {
    "method": "GET",
    "path": "/api/heritage-area-boxes"
  },
  {
    "method": "DELETE",
    "path": "/api/heritage-area-boxes/:areaSeq"
  },
  {
    "method": "GET",
    "path": "/api/heritage-area/travel-categories"
  },
  {
    "method": "GET",
    "path": "/api/heritage-area/travel-categories/:id/keywords"
  },
  {
    "method": "POST",
    "path": "/api/heritage-area/search"
  },
  {
    "method": "QUERY",
    "path": "/api/heritage-area/search"
  },
  {
    "method": "GET",
    "path": "/api/heritage-area/max-area-seq"
  },
  {
    "method": "GET",
    "path": "/api/heritage-area/areas/:areaSeq/items"
  },
  {
    "method": "GET",
    "path": "/api/heritage-cities"
  },
  {
    "method": "POST",
    "path": "/api/heritage-cities"
  },
  {
    "method": "GET",
    "path": "/api/heritage-city-fetched-list"
  },
  {
    "method": "GET",
    "path": "/api/heritage-journey/route-exists"
  },
  {
    "method": "GET",
    "path": "/api/heritage-journey/registered-starts-for-destination"
  },
  {
    "method": "POST",
    "path": "/api/heritage-journey/register-route"
  },
  {
    "method": "GET",
    "path": "/api/heritage-journey/waypoint-set-exists"
  },
  {
    "method": "POST",
    "path": "/api/heritage-journey/save-waypoint-set"
  },
  {
    "method": "GET",
    "path": "/api/heritage-journey/registered-routes"
  },
  {
    "method": "GET",
    "path": "/api/heritage-journey/latest-waypoint-set"
  },
  {
    "method": "POST",
    "path": "/api/airport-nearby-heritage"
  },
  {
    "method": "GET",
    "path": "/api/airport-nearby-heritage-airports"
  },
  {
    "method": "GET",
    "path": "/api/airport-nearby-heritage-ranking"
  },
  {
    "method": "GET",
    "path": "/api/heritage-country-stats"
  },
  {
    "method": "POST",
    "path": "/api/heritage-country-city-stats"
  },
  {
    "method": "POST",
    "path": "/api/heritage-country-unique-cities"
  },
  {
    "method": "POST",
    "path": "/api/heritage-city-heritages"
  },
  {
    "method": "POST",
    "path": "/api/city-all-heritages"
  },
  {
    "method": "GET",
    "path": "/api/heritage-access-ranking"
  },
  {
    "method": "GET",
    "path": "/api/heritage-access/nearby-cities"
  },
  {
    "method": "GET",
    "path": "/heritage-access"
  },
  {
    "method": "GET",
    "path": "/heritage-area"
  }
, { method: "GET", path: "/api/rail-station-nearby" }, { method: "POST", path: "/api/rail-station-nearby" }, {"method":"GET","path":"/api/rail-station-cities"}, {"method":"POST","path":"/api/rail-station-cities"}, {"method":"GET","path":"/api/rail-station-fetched-list"}] as const;
