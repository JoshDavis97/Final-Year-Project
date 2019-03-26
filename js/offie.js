class Offie {
    constructor() {
        this.apiWrapper = undefined;
        this.results = undefined;
        this.utility = undefined;
        this.view = undefined;
        this.settings = undefined;
    }

    /**Initialises the application, instantiating an object of each class and linking them
     * together through properties. Also adds event listeners and loads and initialises
     * settings based on cookie data (if it exists)
     * @returns {Offie}
     */
    init() {
        let apiWrapper = new ApiWrapper(),
            results = new Results(),
            utility = new Utility(),
            view = new View(),
            settings = new Settings();

        this.apiWrapper = apiWrapper;
        this.results = results;
        this.utility = utility;
        this.view = view;
        this.settings = settings;

        this.apiWrapper.results = results;
        this.apiWrapper.utility = utility;

        this.results.apiWrapper = apiWrapper;
        this.results.utility = utility;
        this.results.view = view;

        this.view.utility = utility;
        this.view.settings = settings;
        this.view.apiWrapper = apiWrapper;
        this.view.results = results;
        this.view.initViewFromCookie();

        this.utility.apiWrapper = apiWrapper;
        this.utility.results = results;
        this.utility.view = view;
        this.utility.settings = settings;
        this.utility.addEventListeners();

        this.settings.view = view;
        this.settings.loadSettings();

        return this;
    }
}

class Settings {
    constructor() {
        this.units = 'miles';
        this.theme = 'light';
        this.hidden = true;
        this.view = undefined;
    }

    /**
     * Toggles the display of the settings pane.
     */
    settingsToggle() {
        console.log(this.hidden);
        if(this.hidden) {
            document.getElementById('settingsDiv').style.display = 'inline';
            this.hidden = false;
        }
        else {
            document.getElementById('settingsDiv').style.display = 'none';
            this.hidden = true;
        }
    }

    /**
     * Loads the user's settings from a cookie and reflects them within the class properties.
     */
    loadSettings() {
        let cookie = document.cookie;

        if(cookie.includes('theme=dark'))
            this.theme = 'dark';

        if(cookie.includes('units=kilometres'))
            this.units = 'kilometres';
    }

    /**
     * Updates the application based on the selected settings. Sets the units and theme of the page accordingly.
     * @returns {Settings}
     */
    updateSettings() {
        let unitRadios = document.getElementsByName('units');
        unitRadios.forEach(function(a) {
            if(a.checked) {
                this.units = a.value;
                document.cookie = "units=" + a.value;
            }
        }.bind(this));

        if(document.getElementById('darkmode').checked === true) {
            if(!document.cookie.includes('theme=dark')) {
                this.view.changeStyle();
                this.theme = 'dark';
            }
        }
        else if(document.cookie.includes('theme=dark')) {
            this.view.changeStyle();
            this.theme = 'light';
        }

        return this;
    }
}

/**
 * A class for interfacing with the Google Maps JavaScript API. Handles geocoding of addresses and performing searches.
 */
class ApiWrapper {
    constructor() {
        this.map = undefined;
        this.service = undefined;
        this.geocoder = undefined;
        this.results = undefined;
        this.utility = undefined;
        this.storeTypes = ['convenience_store', 'gas_station', 'liquor_store', 'supermarket'];
    }

    /**
     * Passes the data from the 'Enter your address' text-field into the geocodeAddress() function, initiating a text-
     * based search.
     * @returns {boolean}
     */
    runSearch() {
        if(document.getElementById("adrBox").value === "") {
            alert("Please enter an address before searching. Alternatively, use the geolocation feature.");
            return false;
        }
        else {
            document.getElementById('results-container').innerHTML = "";
            this.results.resultsArray = [];
            this.geocodeAddress(document.getElementById('adrBox').value);
            return true;
        }
    }

    /**
     * Geocodes a given address using the Google Geocoder API, returning a latitude and longitude value & passing it
     * into the findOpenStores() function.
     * @param address - The address to be geocoded.
     * @returns {{lat: number, lng: number}} - The latitude and longitude received from the geocoder API.
     */
    geocodeAddress(address) {
        let latlng = {lat: 0, lng: 0},
            errorStr = 'Sorry, we couldn\'t find that address. Try a more concise address, i.e. a post code or zip code.',

         geocodeComplete = new Promise (function(resolve, reject) {
                this.geocoder.geocode({'address': address}, function(results, status) {
                    if(status === 'OK') {
                        if(results[0].geometry.bounds === undefined) {
                            alert(errorStr);
                        }
                        else {
                            latlng = {lat: results[0].geometry.bounds.ma.j, lng: results[0].geometry.bounds.ga.j};
                            resolve(latlng);
                        }
                    }
                    else if(status === 'ZERO_RESULTS') {
                        alert(errorStr);
                        reject(status);
                    }
                    else {
                        console.log("Geocode ERROR: " + status);
                        latlng = "Geocode ERROR: " + status;
                        reject(status);
                    }
                });
            }.bind(this)
        );

        geocodeComplete
            .then((fulfilled) => {
                console.log("geocode complete: " + fulfilled);
                this.utility.userLoc = latlng;
                this.map.panTo(this.utility.userLoc);
                this.searching = false;
                this.findOpenStores(latlng, 1000);
            })
            .catch((error) => {
                this.searching = false;
                console.log(error);
                console.log("Geocode incomplete");
            });


        return latlng;
    }

    /**
     * Searches for open stores within a given radius of a given location. Repeats the search for each of the values
     * given within the 'storeTypes' array of the class, to obtain a more substantial set of results. Results are sent
     * to the processResults() function of the Results class for processing.
     * @param location - the location to be searched, as an object containing a 'lat' and 'lng' property.
     * @param radius - the distance in metres around the given location which should be searched.
     */
    findOpenStores(location, radius) {
        for(let p of this.storeTypes) {
            if (p !== undefined) {
                console.log("Searching for... : " + p);
                this.service.nearbySearch({
                    location: location,
                    radius: radius,
                    openNow: true,
                    type: p
                }, this.results.processResults.bind(this.results));
            }
        }
    }
}

/**
 * A class for processing and then storing results returned from API calls that have been made in the Api_Wrapper class.
 */
class Results {
    constructor() {
        this.resultsArray = [];
        this.timesProcessed = 0;
        this.utility = undefined;
        this.view = undefined;
        this.apiWrapper = undefined;
    }

    /**
     * Acts as a callback function for the API call made in Api_Wrapper's findOpenStores() function. If the API returns
     * a status of 'OK', this function will take the results array returned by Google and will process it into a format
     * more useful for this application - extracting the important details like name, address, rating, and placeID.
     * @param results - the array of results to be processed.
     * @param status - the status returned by the Google Places Service.
     */
    processResults(results, status) {
        if(status === google.maps.places.PlacesServiceStatus.OK) {
            for(let r in results) {
                let latlng = {lat: results[r].geometry.location.lat(), lng: results[r].geometry.location.lng()};

                let resultToAdd = new Shop(
                    results[r].name,
                    results[r].vicinity,
                    latlng,
                    results[r].rating,
                    results[r].place_id,
                    this.utility.getDistance(latlng)
                );


                let found = false;
                if(this.resultsArray.length > 0) {
                    for (let j = 0; j < this.resultsArray.length; j++) {
                        if (this.resultsArray[j].placeId === resultToAdd.placeId) {
                            found = true;
                            break;
                        }
                    }
                    if(found === false) {
                        this.resultsArray.push(resultToAdd);
                    }
                }
                else {
                    this.resultsArray.push(resultToAdd);
                }
            }

            this.timesProcessed++;
            if(this.timesProcessed === this.apiWrapper.storeTypes.length) {
                this.view.populateResults(this.resultsArray, this.utility.getSortType());
                this.timesProcessed = 0;
            }
        }
        else {
            console.log("ERROR: PlacesServiceStatus - " + status);
        }
    }

    /**
     * Sorts the given array into a given order, using a specific algorithm. Can be used to sort an array by name,
     * distance, or rating.
     * @param array - the array of Shops to be sorted.
     * @param sortBy - the method to use when sorting ('distance', 'rating', or 'name').
     */
    sortResults(array, sortBy) {
        if(sortBy === 'distance') {
            array.sort(function(a,b) {
                return a.distance - b.distance;
            });
        }
        else if(sortBy === 'rating') {
            array.sort(function(a,b) {
                if(a.rating === b.rating) {
                    return b.distance - a.distance;
                }
                return b.rating - a.rating;
            });
        }
        else if(sortBy === 'name') {
            array.sort(function(a,b) {
                let nameA = a.name.toLowerCase(),
                    nameB = b.name.toLowerCase();

                if(nameA > nameB)
                    return 1;
                else if(nameA < nameB)
                    return -1;
                else
                    return 0;

            });
        }
    }

}

/**
 * A simple class used to store information on a specific shop. Stores data regarding the name, address, coordinates,
 * rating, placeID, and distance from the user.
 */
class Shop {
    constructor(name, address, latlng, rating, placeId, distance) {
        this.name = name;
        this.address = address;
        this.latlng = latlng;
        this.rating = rating;
        this.placeId = placeId;
        this.distance = distance;
    }
}

/**
 * A class used to control elements of the view of the application. This includes displaying results, as well as
 * switching between the two available themes.
 */
class View {
    constructor() {
        this.results = undefined;
        this.utility = undefined;
        this.settings = undefined;
        this.apiWrapper = undefined;
    }

    /**
     * Creates a <div> element for each result in the supplied array containing the information for each shop that has
     * been found. Also adds markers to the interactive map, alongside tooltips for these markers.
     * @param resultsArray - the array of results to build the divs, markers, and tooltips from.
     * @param sortType - the sorting type to be applied when displaying the results ('distance', 'rating', or 'name')
     */
    populateResults(resultsArray, sortType) {
        document.getElementById('results-container').innerHTML = "";
        if(resultsArray === null) {
            resultsArray = this.results.resultsArray;
        }
        let count = 0;
        this.results.sortResults(resultsArray, sortType);
        resultsArray.forEach(function(a) {
            count++;
            let resultsContainer = document.getElementById('results-container'),
                newElement = document.createElement("div"),
                newNode = resultsContainer.appendChild(newElement);

            newNode.setAttribute("id",  "result-" + a.placeId);
            newNode.setAttribute("class", "result");
            if(resultsArray.length === count)
                newNode.setAttribute("class", "result-last");

            let ratingStr = '';
            if(a.rating !== undefined)
                ratingStr = " : " + a.rating + " ★ : ";
            else
                ratingStr = " (no rating) : ";

            let unitsStr = '';
            if(this.settings.units === 'miles')
                unitsStr = 'miles away';
            else
                unitsStr = 'km away';

            let str = a.name +  ratingStr + a.distance.toFixed(2) + unitsStr + "</br>" + this.utility.getMapsUrl(a);
            newNode.innerHTML = str;

            this.addToMap(a, str);

        }, this);
    }

    addToMap(shop, infoString) {
        let infoWindow = new google.maps.InfoWindow({
            content: infoString
        });

        let marker = new google.maps.Marker({
            position: shop.latlng,
            map: this.apiWrapper.map,
            title: shop.name
        });

        marker.addListener('click', function() {
            infoWindow.open(this.apiWrapper.map, marker);
        }.bind(this));
    }

    /**
     * Loads the users previously saved settings from a cookie, and updates the page by checking the relevant boxes in
     * the 'Settings' pane, as well as changing the theme to darkmode if necessary.
     */
    initViewFromCookie() {
        let cookie = document.cookie;

        if(cookie.includes('theme=dark')) {
            this.changeStyle();
            document.getElementById('darkmode').checked = true;
        }

        if(cookie.includes('units=miles')) {
            document.getElementById('units-mi').checked = true;
        }
        else {
            document.getElementById('units-km').checked = true;
        }
    }

    /**
     * A function used to switch between the two available themes, which will update the CSS used for colouring elements,
     * as well as which versions of the Google logo and Geolocate button will be used. Automatically detects which theme
     * is currently active, and switches to the opposite one.
     */
    changeStyle() {
        let oldTheme = document.getElementById('css-theme'),
            newTheme = document.createElement('link'),
            oldGLogo = document.getElementById('google-logo'),
            newGLogo = document.createElement('img'),
            oldGeoIcon = document.getElementById('geolocate-button'),
            newGeoIcon = document.createElement('img'),
            cookieStr = '';

        newTheme.setAttribute('rel', 'stylesheet');
        newTheme.setAttribute('type', 'text/css');
        newTheme.setAttribute('id', 'css-theme');

        newGLogo.setAttribute('alt', 'Powered by Google');
        newGLogo.setAttribute('id', 'google-logo');

        newGeoIcon.setAttribute('id', 'geolocate-button');
        newGeoIcon.setAttribute('alt', 'Search by location');

        if(oldTheme.href.includes('dark')) {
            newTheme.setAttribute('href', 'css/light.css');
            newGLogo.setAttribute('src', 'media/powered_by_google_on_white.png');
            newGeoIcon.setAttribute('src', 'media/geo_icon_light.png');
            cookieStr = "theme=light";
        }
        else {
            newTheme.setAttribute('href', 'css/dark.css');
            newGLogo.setAttribute('src', 'media/powered_by_google_on_non_white.png');
            newGeoIcon.setAttribute('src', 'media/geo_icon_dark.png');
            cookieStr = "theme=dark";
        }

        try {
            oldTheme.parentNode.replaceChild(newTheme, oldTheme);
            oldGLogo.parentNode.replaceChild(newGLogo, oldGLogo);
            oldGeoIcon.parentNode.replaceChild(newGeoIcon, oldGeoIcon);

            document.cookie = cookieStr;

            document.getElementById('geolocate-button').addEventListener('click', function() {
                this.utility.geolocate();
            }.bind(this));
        }
        catch(error) {
            console.log("ERROR: Could not change style - " + error);
        }

    }
}

/**
 * A class to contain all of the utility functions for the application, as well as functions which do not seamlessly
 * fit into any of the other more specific classes. Handles sorting, HTML5 geolocation, generating URLs for Maps links,
 * determining the distance between the user and a shop, and adding event listeners to certain buttons.
 */
class Utility {
    constructor() {
        this.userLoc = {lat: 0, lng: 0};
        this.apiWrapper = undefined;
        this.results = undefined;
        this.view = undefined;
        this.settings = undefined;
    }

    /**
     * Repopulates the results based on the selection of a new Sorting algorithm..
     * @param sortType - the type of sorting to be employed ('distance', 'rating', or 'name')
     */
    sortChange(sortType) {
        if(this.results.resultsArray !== []) {
            this.view.populateResults(this.results.resultsArray, sortType);
        }
    }

    /**
     * Returns the value of the 'Sort-by' drop-down box, to determine how results should be sorted.
     * @returns string - the sort type ('distance', 'rating', or 'name')
     */
    getSortType() {
        return document.getElementById('sort-dropdown').value;
    }

    /**
     * Uses the HTML5 Geolocator to return coordinates (latitude, longitude) based on the users current position.
     */
    geolocate() {
        if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                let latlng = {lat: position.coords.latitude, lng: position.coords.longitude};
                this.userLoc = latlng;
                this.apiWrapper.map.panTo(this.userLoc);
                this.apiWrapper.findOpenStores(latlng, 1000);
            }.bind(this));
        } else {
            alert("Your browser doesn't support location search.");
        }
    }

    /**
     * Converts from degrees to radians, for determining the distance between two locations.
     * @param degrees - the degree value to be converted.
     * @returns {number} - the given degrees, in radians.
     */
    static convertDegreesToRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    /**
     * Employs the Haversine formula to determine the distance between two points on a sphere. Used for finding the
     * distance between a users location and a store.
     * @param shopLoc - the coordinates of the shop of which to find the distance from.
     * @returns {number} - the distance between the two points, in either km or mi (determined by the users settings).
     */
    getDistance(shopLoc) {
        let radius = 6378,
            lat = Utility.convertDegreesToRadians(this.userLoc.lat - shopLoc.lat),
            lng = Utility.convertDegreesToRadians(this.userLoc.lng - shopLoc.lng);

        let a =   Math.sin(lat / 2)
                * Math.sin(lat / 2)
                + Math.cos(Utility.convertDegreesToRadians(this.userLoc.lat))
                * Math.cos(Utility.convertDegreesToRadians(this.userLoc.lat))
                * Math.sin(lng / 2)
                * Math.sin(lng / 2);

        let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        let distance = radius * c;

        if(this.settings.units === 'miles') {
            distance = distance * 0.62137;
        }
        return distance;
    }

    /**
     * Generates a Google Maps URL for a specific place.
     * @param store - the place to generate a URL for.
     * @returns {string | *} - the URL of the place on Google Maps.
     */
    getMapsUrl(store) {
        let url = "https://www.google.com/maps/search/?api=1&query=",
            linkText = store.address;

        url += store.name + "&query_place_id=" + store.placeId;

        return linkText.link(url);
    }

    /**
     * Adds event listeners to the settings icon, the settings 'close' icon, the geolocation button, and the settings
     * 'submit' button.
     */
    addEventListeners() {
        document.getElementById('settings-icon').addEventListener('click', function() {
            this.settings.settingsToggle();
        }.bind(this));

        document.getElementById('settings-close-icon').addEventListener('click', function() {
            this.settings.settingsToggle();
        }.bind(this));

        document.getElementById('geolocate-button').addEventListener('click', function() {
            this.geolocate();
        }.bind(this));

        document.getElementById('settings-submit').addEventListener('click', function() {
            this.settings.updateSettings()
        }.bind(this));
    }
}