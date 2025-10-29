// 지도 초기화
const map = L.map('map', {
    maxZoom: 22,
    zoomControl: true
}).setView([36.014352, 129.3257493], 18);

// OpenStreetMap 타일 레이어 추가 (더 높은 해상도 지원)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 22,
    minZoom: 3
}).addTo(map);

// 상태 관리
let state = {
    mode: 'idle', // idle, adding_points
    points: [],
    polygon: null,
    markers: []
};

// UUID 생성 함수
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 포인트 추가 모드 시작
function startAddingPoints() {
    state.mode = 'adding_points';
    updateModeIndicator();
    map.on('click', addPoint);
}

// 포인트 추가
function addPoint(e) {
    if (state.mode !== 'adding_points') return;
    
    const point = {
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        id: generateUUID()
    };
    
    state.points.push(point);
    
    // 마커 추가 (더 작고 정확한 마커)
    const marker = L.marker([point.lat, point.lng], {
        draggable: true,
        icon: L.divIcon({
            className: 'custom-marker',
            html: '<div style="background-color: #3388ff; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 2px #3388ff;"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        })
    }).addTo(map);
    
    marker.on('dragend', function() {
        const index = state.markers.indexOf(marker);
        if (index !== -1) {
            state.points[index].lat = marker.getLatLng().lat;
            state.points[index].lng = marker.getLatLng().lng;
            updatePolygon();
            updatePointsList();
        }
    });
    
    marker.on('click', function() {
        if (confirm('이 포인트를 삭제하시겠습니까?')) {
            removePoint(point.id, marker);
        }
    });
    
    state.markers.push(marker);
    
    updatePolygon();
    updatePointsList();
}

// 포인트 제거
function removePoint(pointId, marker) {
    const index = state.points.findIndex(p => p.id === pointId);
    if (index !== -1) {
        state.points.splice(index, 1);
        map.removeLayer(state.markers[index]);
        state.markers.splice(index, 1);
        updatePolygon();
        updatePointsList();
    }
}

// 폴리곤 업데이트
function updatePolygon() {
    if (state.polygon) {
        map.removeLayer(state.polygon);
    }
    
    if (state.points.length >= 3) {
        const latlngs = state.points.map(p => [p.lat, p.lng]);
        
        // 폐곡선을 위해 첫 번째 포인트를 마지막에 추가
        latlngs.push([state.points[0].lat, state.points[0].lng]);
        
        state.polygon = L.polygon(latlngs, {
            color: '#3388ff',
            fillColor: '#3388ff',
            fillOpacity: 0.2,
            weight: 2
        }).addTo(map);
    }
}

// 포인트 리스트 업데이트
function updatePointsList() {
    const list = document.getElementById('pointsList');
    
    if (state.points.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">클릭한 포인트가 여기 표시됩니다</div>';
        return;
    }
    
    list.innerHTML = state.points.map((point, index) => `
        <div class="point-item">
            <span>포인트 ${index + 1}: ${point.lat.toFixed(8)}, ${point.lng.toFixed(8)}</span>
            <button class="remove-btn" onclick="removePoint('${point.id}', state.markers[${index}])">삭제</button>
        </div>
    `).join('');
}

// 폴리곤 완료
function finishPolygon() {
    if (state.mode === 'adding_points') {
        state.mode = 'idle';
        map.off('click', addPoint);
        updateModeIndicator();
        
        if (state.points.length < 3) {
            alert('최소 3개의 포인트가 필요합니다.');
            return;
        }
        
        alert(`폴리곤이 완성되었습니다! (${state.points.length}개 포인트)`);
    }
}

// 포인트 지우기
function clearPoints() {
    if (confirm('모든 포인트와 폴리곤을 삭제하시겠습니까?')) {
        state.markers.forEach(marker => map.removeLayer(marker));
        if (state.polygon) {
            map.removeLayer(state.polygon);
        }
        state.points = [];
        state.markers = [];
        state.polygon = null;
        state.mode = 'idle';
        map.off('click', addPoint);
        updateModeIndicator();
        updatePointsList();
    }
}

// 모드 인디케이터 업데이트
function updateModeIndicator() {
    const indicator = document.getElementById('modeIndicator');
    const modeText = document.getElementById('modeText');
    
    if (state.mode === 'adding_points') {
        indicator.classList.add('active');
        modeText.textContent = '포인트 추가 중 - 지도를 클릭하세요';
    } else {
        indicator.classList.remove('active');
        modeText.textContent = '대기 중';
    }
}

// 폴리곤 좌표 가져오기 (GeoJSON 형식)
function getPolygonCoordinates() {
    if (state.points.length < 3) return null;
    
    const coordinates = state.points.map(p => [p.lng, p.lat]); // GeoJSON은 [lng, lat] 순서
    // 폐곡선을 위해 첫 번째 좌표를 마지막에 추가
    coordinates.push([coordinates[0][0], coordinates[0][1]]);
    
    return [coordinates];
}

// 폴리곤 중심점 계산
function getPolygonCenter() {
    if (state.points.length === 0) return null;
    
    const sumLat = state.points.reduce((sum, p) => sum + p.lat, 0);
    const sumLng = state.points.reduce((sum, p) => sum + p.lng, 0);
    
    return [sumLng / state.points.length, sumLat / state.points.length];
}

// IMDF 파일 생성
function createIMDFBundle() {
    const coordinates = getPolygonCoordinates();
    if (!coordinates) {
        alert('먼저 폴리곤을 만들어주세요 (최소 3개 포인트 필요)');
        return null;
    }
    
    const center = getPolygonCenter();
    const venueId = generateUUID();
    const buildingId = generateUUID();
    const addressId = generateUUID();
    const levelId = generateUUID();
    const footprintGroundId = generateUUID();
    const footprintAerialId = generateUUID();
    
    // Venue 데이터
    const venue = {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            id: venueId,
            feature_type: "venue",
            properties: {
                category: document.getElementById('venueCategory').value || "unspecified",
                restriction: null,
                name: {
                    ko: document.getElementById('venueNameKo').value || "Venue",
                    en: document.getElementById('venueNameEn').value || "Venue"
                },
                alt_name: null,
                hours: "Mo-Su 00:00-24:00",
                phone: null,
                website: null,
                display_point: {
                    type: "Point",
                    coordinates: center
                },
                address_id: addressId
            },
            geometry: {
                type: "Polygon",
                coordinates: coordinates
            }
        }]
    };
    
    // Building 데이터
    const building = {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            id: buildingId,
            feature_type: "building",
            properties: {
                name: {
                    ko: document.getElementById('buildingNameKo').value || "Building",
                    en: document.getElementById('buildingNameEn').value || "Building"
                },
                alt_name: null,
                category: "unspecified",
                restriction: null,
                display_point: {
                    type: "Point",
                    coordinates: center
                },
                address_id: addressId
            },
            geometry: null
        }]
    };
    
    // Address 데이터
    const address = {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            id: addressId,
            feature_type: "address",
            properties: {
                address: document.getElementById('addressStreet').value || "",
                unit: null,
                locality: document.getElementById('addressCity').value || "",
                province: document.getElementById('addressProvince').value || "",
                country: document.getElementById('addressCountry').value || "KR",
                postal_code: document.getElementById('addressPostal').value || "",
                postal_code_ext: null,
                postal_code_vanity: null
            },
            geometry: null
        }]
    };
    
    // Level 데이터
    const level = {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            id: levelId,
            feature_type: "level",
            properties: {
                category: "unspecified",
                restriction: null,
                outdoor: false,
                ordinal: 1,
                name: {
                    ko: "Level 1",
                    en: "Level 1"
                },
                short_name: {
                    ko: "L1",
                    en: "L1"
                },
                display_point: {
                    type: "Point",
                    coordinates: center
                },
                address_id: null,
                building_ids: [buildingId]
            },
            geometry: {
                type: "Polygon",
                coordinates: coordinates
            }
        }]
    };
    
    // Footprint 데이터
    const footprint = {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                id: footprintGroundId,
                feature_type: "footprint",
                properties: {
                    category: "ground",
                    name: null,
                    building_ids: [buildingId]
                },
                geometry: {
                    type: "Polygon",
                    coordinates: coordinates
                }
            },
            {
                type: "Feature",
                id: footprintAerialId,
                feature_type: "footprint",
                properties: {
                    category: "aerial",
                    name: null,
                    building_ids: [buildingId]
                },
                geometry: {
                    type: "Polygon",
                    coordinates: coordinates
                }
            }
        ]
    };
    
    // Manifest 데이터
    const manifest = {
        version: "1.0.0",
        created: new Date().toISOString(),
        generated_by: "IMDF Builder",
        language: "ko-KR"
    };
    
    return {
        venue: venue,
        building: building,
        address: address,
        level: level,
        footprint: footprint,
        manifest: manifest
    };
}

// IMDF 번들 다운로드
async function exportIMDF() {
    const bundle = createIMDFBundle();
    if (!bundle) return;
    
    try {
        const zip = new JSZip();
        
        // 각 파일을 ZIP에 추가
        zip.file("venue.geojson", JSON.stringify(bundle.venue, null, 2));
        zip.file("building.geojson", JSON.stringify(bundle.building, null, 2));
        zip.file("address.geojson", JSON.stringify(bundle.address, null, 2));
        zip.file("level.geojson", JSON.stringify(bundle.level, null, 2));
        zip.file("footprint.geojson", JSON.stringify(bundle.footprint, null, 2));
        zip.file("manifest.json", JSON.stringify(bundle.manifest, null, 2));
        
        // ZIP 파일 생성 및 다운로드
        const content = await zip.generateAsync({type: "blob"});
        const url = URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        a.download = "imdf-bundle.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('IMDF 번들이 성공적으로 생성되었습니다!');
    } catch (error) {
        console.error('Export error:', error);
        alert('다운로드 중 오류가 발생했습니다: ' + error.message);
    }
}
