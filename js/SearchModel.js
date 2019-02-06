class SearchModel {

    constructor() {
        this.processedResults = [];
        this.timesProcessed = 0;
        this.storeTypes = ['convenience_store', 'gas_station', 'liquor_store', 'supermarket'];
    }

    locationSearch() {
        if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(this.locationSearchCallback.bind(this));
        } else {
            alert("Your browser doesn't support location search.");
        }
    }

    locationSearchCallback(position) {
        let latlng = {lat: position.coords.latitude, lng: position.coords.longitude};
        this.findOpenStores(service, latlng, 1000);
        console.log(latlng);
    }

    //TODO - Check what type of input is in search field e.g. address, coords, etc - to avoid performing unnecessary geocode
    runSearch() {

        if(document.getElementById("adrBox").value === "") {
            alert("Please enter an address before searching. Alternatively, use the geolocation feature.")
        }
        else {
            document.getElementById('resultsDiv').innerHTML = "";
            this.geocodeAddress(document.getElementById('adrBox').value);
        }
    }

    geocodeAddress(address) {
        let latlng = {lat: 0, lng: 0},
            geocodeComplete = new Promise (function(resolve, reject) {
                geocoder.geocode({'address': address}, function(results, status) {
                    if(status === 'OK') {
                        console.log(results);
                        console.log(latlng);
                        latlng = {lat: results[0].geometry.bounds.ma.j, lng: results[0].geometry.bounds.ga.j};
                        console.log("Geocode successful: " + latlng.lat + ", " + latlng.lng);
                        resolve(latlng);
                    }
                    else {
                        console.log("Geocode ERROR: " + status);
                        latlng = "Geocode ERROR: " + status;
                        reject(status);
                    }
                });
            }
        );

        geocodeComplete
            .then((fulfilled) => {
                console.log("geocode complete: " + fulfilled);
                this.findOpenStores(service, latlng, 1000);
            })
            .catch((error) => {
                console.log("Geocode incomplete");
            });

        return latlng;
    }

    findOpenStores(service, location, radius) {
        for(let p of this.storeTypes) {
            if (p !== undefined) {
                console.log("Searching for... : " + p);
                service.nearbySearch({
                    location: location,
                    radius: radius,
                    openNow: true,
                    type: p
                }, this.processResults.bind(this));
            }
        }
    }

    processResults(results, status) {
        console.log(this);
        if(status === google.maps.places.PlacesServiceStatus.OK) {
            for(let r in results) {
                let resultToAdd = new Shop(results[r].name, results[r].vicinity, results[r].rating, results[r].place_id),
                    found = false;

                if(this.processedResults.length > 0) {
                    for (let j = 0; j < this.processedResults.length; j++) {
                        if (this.processedResults[j].placeId === resultToAdd.placeId) {
                            found = true;
                            break;
                        }
                    }
                    if(found === false) {
                        this.processedResults.push(resultToAdd);
                    }
                }
                else {
                    this.processedResults.push(resultToAdd);
                }
            }

            this.timesProcessed++;
            if(this.timesProcessed === this.storeTypes.length) {
                this.populateResults();
            }
        }
        else {
            console.log("ERROR: PlacesServiceStatus - " + status);
        }
    }

    populateResults() {
        for(let a in this.processedResults) {
            let str = "",
                newElement = document.createElement("div"),
                newNode = resultsDiv.appendChild(newElement);

            newNode.setAttribute("id", this.processedResults[a].placeId);
            newNode.setAttribute("class", "result");

            if(this.processedResults[a].rating !== undefined)
                str = this.processedResults[a].name +  " : " + this.processedResults[a].rating + " ★" + "</br>" + SearchModel.getMapsUrl(this.processedResults[a]);
            else
                str = this.processedResults[a].name +  " (no rating)" + "</br>" + SearchModel.getMapsUrl(this.processedResults[a]);

            newNode.innerHTML = str;
        }
        this.timesProcessed = 0;
    }

    static getMapsUrl(store) {
        let url = "https://www.google.com/maps/search/?api=1&query=",
            linkText = store.address;

        url += store.name + "&query_place_id=" + store.placeId;

        return linkText.link(url);
    }

}