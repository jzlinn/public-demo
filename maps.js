$(document).ready(function () {

    console.log("****####****");

    localStorage.removeItem("currentLng");
    localStorage.removeItem("currentLat");

    let headers = {
        'Authorization': 'Bearer ' + localStorage.getItem("userAccessBearerToken"),
        'Content-Type': 'application/json'
    };

    var mapData = [];
    var map = null;
    var origin = {};
    var map_canvas;
    var nearestROMap = [];
    var roMap = [];
    var nearestROMarker;
    var currentLat = 12.9716, currentLng = 77.5946;

    $('.modal').modal({
        // dismissible: false
    });
    document.addEventListener("deviceready", function () {
        map_canvas = document.getElementById("mapView");

        let selectedProduct, prevoiusPage;

        selectedProduct = JSON.parse(localStorage.getItem("selectedProduct"));

        prevoiusPage = document.referrer.split("/")[3];

        if (selectedProduct) {

            if (selectedProduct.length > 0) {
                console.log("****## filters ##****");

                let searchURL = config.ERP_HOST + config.CP_SEARCH_LIST;
                var payloadData = {
                    // "regionId": selectedState,
                    // "locationId": selectedCity,
                    "productIds": selectedProduct
                };

                let getSearchedCS = {
                    "url": searchURL,
                    "headers": headers,
                    "data": JSON.stringify(payloadData),
                };

                plugin.google.maps.environment.setEnv({
                    'API_KEY_FOR_BROWSER_RELEASE': config.GOOGLE_MAP_API_KEY, // google map api key for browser inside config.js file
                    'API_KEY_FOR_BROWSER_DEBUG': config.GOOGLE_MAP_API_KEY
                });
                initializeGMap(currentLat, currentLng);

                callPostAPI(getSearchedCS, function (listAllSearchedCS) { // used for make ajax call for post data to api
                    if (listAllSearchedCS.length > 0) {
                        mapData = [];
                        mapData = listAllSearchedCS;
                        console.log("fetched data = ", listAllSearchedCS);
                        $('select').formSelect();
                        
                    } else {
                        console.log("empty");
                        M.toast({ html: "No Charging Station for " + selectedProduct });
                    }
                }, function (error) {
                    console.log("error = ", error);
                });
            }
        } else {

            console.log("****## normal ##****");

            var url = config.ERP_HOST + config.GETCHARGINGSTATION;

            let payloadData = {
                "headers": headers,
                "url": url
            };

            plugin.google.maps.environment.setEnv({
                'API_KEY_FOR_BROWSER_RELEASE': config.GOOGLE_MAP_API_KEY,
                'API_KEY_FOR_BROWSER_DEBUG': config.GOOGLE_MAP_API_KEY
            });
            initializeGMap(currentLat, currentLng);

            callGetAPI(payloadData, function (chargingStation) { // used for make ajax call for get data from api
                mapData = [];
                mapData = chargingStation;

                console.log("mapData = chargingStation = ", chargingStation);
                
            }, function (error) {
                console.log("error = ", error);
            });
        }
    }, false);

    function onSuccess(pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        initializeGMap(lat, lng);
    }

    function initializeGMap(lat, lng) {
        myLatlng = new plugin.google.maps.LatLng(parseFloat(lat), parseFloat(lng));

        var myOptions = {
            'camera': {
                'target': {
                    lat: lat,
                    lng: lng
                },
                'tilt': 5,
                'zoom': 11.5,
                'bearing': 50
            },
        };

        map = plugin.google.maps.Map.getMap(map_canvas, myOptions);

        map.on(plugin.google.maps.event.MAP_READY, function () {
            map.addMarkerCluster({
                boundsDraw: true,
                markers: createMarkers(),
                icons: [
                    { min: 2, max: 100, url: "/img/marker_map.png", anchor: { x: 160, y: 160 } },
                    { min: 100, max: 1000, url: "/img/marker_map.png", anchor: { x: 16, y: 16 } },
                    { min: 1000, max: 2000, url: "/img/marker_map.png", anchor: { x: 24, y: 24 } },
                    { min: 2000, url: "/img/marker_map.png", anchor: { x: 32, y: 32 } }
                ]
            }, (markerCluster) => {
                markerCluster.on(plugin.google.maps.event.MARKER_CLICK, (position, marker) => {
                    $('#stationName').text(marker.get("name"));
                    $('#stationLocation').text(marker.get("location"));
                    $('#stationId').val(marker.get("id"))
                    if (marker.get("status") == 1) {
                        $('#stationStatus').text('Active');
                    } else {
                        $('#stationStatus').text('Inactive');
                    }

                    $('#mapInfoModal').show();
                    // $('#mapInfoModal').modal('show');
                    // $('.modal.open').modal('close');
                    // $('#mapInfoModal').show();
                    setTimeout(function () {
                        cordova.fireDocumentEvent('plugin_touch', {});
                    }, 300);
                });
            });
        });
        map.one(plugin.google.maps.event.MAP_READY, function () {
            // showNearestROs();
            var onSuccess = function (location) {
                var msg = "You're here";
                currentLat = location.latLng.lat;
                currentLng = location.latLng.lng;

                localStorage.setItem("currentLat", location.latLng.lat);
                localStorage.setItem("currentLng", location.latLng.lng);

                showNearestROs();
                map.addMarker({
                    'position': location.latLng,
                    'title': msg
                }, function (marker) {
                    marker.showInfoWindow();
                    map.animateCamera({
                        target: location.latLng,
                        zoom: 16
                    }, function () {
                        // marker.showInfoWindow();
                    });
                });
            };
            var onError = function (msg) {
                //   console.log(JSON.stringify(msg));
                //   initializeGMap(12.9716, 77.5946);
            };
            var options = {
                enableHighAccuracy: true  // Set true if you want to use GPS. Otherwise, use network.
            };
            map.getMyLocation(options, onSuccess, onError);
        });
        $('#mapView').css("background-color", "transparent");
    }

    function showNearestROs() {
        mapData.forEach(roData => {
            var coordinates = roData.coordinates.substring(1, roData.coordinates.length).substring(0, roData.coordinates.length - 2).split(',');
            var destination = {
                lat: parseFloat(coordinates[0].trim()),
                lng: parseFloat(coordinates[1].trim()),
            };
            origin = {
                lat: parseFloat(localStorage.getItem("currentLat").trim()),
                lng: parseFloat(localStorage.getItem("currentLng").trim()),
            };
            if (roData.status === 1) {
                calculateRoadMapDistance(origin, destination, roData);
            } else {
                console.log("Charging station unavailable");
            }
        });
    }

    function calculateRoadMapDistance(origin, destination, roData) {
        var service = new google.maps.DistanceMatrixService();
        service.getDistanceMatrix({
            origins: [origin],
            destinations: [destination],
            travelMode: 'DRIVING',
            // unitSystem: google.maps.UnitSystem.METRIC,
            // unitSystem: google.maps.UnitSystem.IMPERIAL,
            // avoidHighways: false,
            // avoidTolls: false
        }, function (response, status) {
            if (status !== 'OK') {
                console.log('Error was: ' + status);
            } else {

                var travelInfo = response.rows[0].elements[0]

                if (travelInfo.status == 'OK') {
                    roMap.push({
                        'distance': parseFloat(travelInfo.distance.text.split(" ")[0].replace(/,/g, '')),
                        'duration': travelInfo.duration.text,
                        'data': roData,
                    });
                } else {
                    console.log("error = ", travelInfo.status);
                }
            }
        });
    }

    $('#viewNearByROs').css('display', 'block');

    $(document).on("click", "#viewNearByROs", function (event) {
        console.log("====== romap ====== ", roMap);

        if (roMap.length > 0) {
            $("#nearROContainer").empty();
            nearestROMap = roMap.filter(obj => obj.distance <= 30);
            nearestROMap.sort(function (a, b) {
                return a.distance - b.distance;
            });

            nearestROMap.forEach(obj => {

                element = obj.data.connectorNames;

                $('#nearROContainer').append(
                    '<div class="row roList" style="margin-bottom: 10px !important;">' +

                    '<div class="col s12 m12 l12 " style="padding: 0px !important;">' +

                    '<div class="col s10 m10 l10">' +
                    '<h6 class="directionDataContainer">'
                    + obj.data.chargeStationName + ' - '
                    + obj.distance + ' kms | '
                    + obj.duration +
                    '</h6>' +
                    '</div>' +

                    '<div class="col s2 m2 l2 roListDirection">' +
                    '<a href="#!"><h5 class="listNearestActiveRos" coordinates="'
                    + obj.data.coordinates + '" data-id="'
                    + obj.data.chargeStationId
                    + '" ><i class="fas fa-directions"></i></h5></a>' +
                    '</div>' +

                    '</div>' +

                    '</div>'
                );
            });
        } else {
            $("#nearROContainer").empty();
            $('#nearROContainer').append(
                '<h6>No Charging Stations available for your search</h6>'
            );
        }
    })

    $(document).on('click', '.listNearestActiveRos', function (event) {
        event.preventDefault();

        $("#closeModal").trigger("click");
        $('#nearestInfoModal').modal({ dismissible: true });

        // var roId = event.currentTarget.attributes['data-id'].value;
        var coordinates = event.currentTarget.attributes['coordinates'].value;

        var targetLatitude = parseFloat(coordinates.substring(1, coordinates.length - 1).split(",")[0].trim());
        var targetLongitude = parseFloat(coordinates.substring(1, coordinates.length - 1).split(",")[1].trim());
        var addressLongLat = targetLatitude + ',' + targetLongitude;
        window.open("geo:" + addressLongLat);

    });

    function createMarkers() {
        var chargingStationData = [];
        for (var i = 0; i < mapData.length; i++) {
            var coordinates = mapData[i].coordinates.substring(1, mapData[i].coordinates.length).substring(0, mapData[i].coordinates.length - 2).split(',');
            if (mapData[i].status === 1) {
                var mapJson = {
                    "position": {
                        "lat": coordinates[0],
                        "lng": coordinates[1]
                    },
                    "name": mapData[i].chargeStationName,
                    "location": mapData[i].locationName,
                    "id": mapData[i].chargeStationId,
                    "status": mapData[i].status,
                    "icon": "/img/map-marker-2-32.png"
                };
            } else {
                var mapJson = {
                    "position": {
                        "lat": coordinates[0],
                        "lng": coordinates[1]
                    },
                    "name": mapData[i].chargeStationName,
                    "location": mapData[i].locationName,
                    "id": mapData[i].chargeStationId,
                    "status": mapData[i].status,
                    "icon": "/img/marker_map.png"
                };
            }

            chargingStationData.push(mapJson);
        }
        console.log("drawing markers");
        return chargingStationData;
    }
    function onError(error) {
        initializeGMap(currentLat, currentLng);
    }

    $('#closeModalBtn').click((event) => {
        try {
            $('#mapInfoModal').modal().close();
            $('#nearestInfoModal').modal().close();
        } catch (e) {
            $('.modal.open').modal('close');
        }
    });

    $("#getCurrentLocation").click(() => {
        loadUserLiveLocation(localStorage.getItem("currentLat"), localStorage.getItem("currentLng"))
    });

    function loadUserLiveLocation(latitudeData, longitudeData) {
        $("#closeModal").trigger("click");
        if (nearestROMarker) nearestROMarker.remove();
        nearestROMarker = map.addMarker({
            'position': {
                lat: latitudeData,
                lng: longitudeData
            },
            // "icon": "/img/marker_map.png",
            'snippet': "You're here"
        }, function (marker) {
            try {
                nearestROMarker = marker;
                map.animateCamera({
                    target: { lat: latitudeData, lng: longitudeData },
                    zoom: 16
                }, function () {
                    marker.showInfoWindow();
                    marker.setAnimation(plugin.google.maps.Animation.DROP);
                });
                marker.on(plugin.google.maps.event.MARKER_CLICK, function (position, marker) {
                    marker.setAnimation(plugin.google.maps.Animation.BOUNCE);
                });
            } catch (error) {
                console.log(error);
                console.log("error occurred = ", error)
            }
        });
    }

});
