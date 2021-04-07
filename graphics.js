import * as THREE from 'https://unpkg.com/three@0.119.0/build/three.module.js';
import {
    OrbitControls
} from '../lib/OrbitControls.js';

const windowWidth = window.innerWidth,
    windowHeight = window.innerHeight,
    bounds = [520236, 4466004, 646682, 4546128], // UTM 18T source:http://www.synnatschke.de/geo-tools/coordinate-converter.php
    boundsWidth = bounds[2] - bounds[0],
    boundsHeight = bounds[3] - bounds[1],
    sceneWidth = windowWidth,
    sceneHeight = windowWidth * (boundsHeight / boundsWidth),
    posX = 0,
    posY = 0,
    posZ = 800;

const squareSize = 450,
    xSquares = boundsWidth / squareSize,
    ySquares = boundsHeight / squareSize,
    boxSize = sceneWidth / xSquares,
    valueFactor = 1;

let nyc, light, group;

const barHeightScale = d3.scaleLinear().range([1, 200]),
    colorScale = d3.scaleLinear()
    .range(['#FFFFFF', '#E4FF1A']); //'#DB2763'

// initialize a renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(windowWidth, windowHeight);

// add it to the target element
const mapDiv = document.getElementById('map');
mapDiv.appendChild(renderer.domElement);

// camera
const fov = 50,
    aspectRatio = windowWidth / windowHeight,
    near = 1,
    far = 4000;

const camera = new THREE.PerspectiveCamera(fov, aspectRatio, near, far)
camera.position.set(posX, posY, posZ);
camera.lookAt(new THREE.Vector3(0, 0, 0));

// create a basic scene and add camera
var scene = new THREE.Scene();
// scene.background = new THREE.Color(0xa0a0a0);
scene.add(camera);

// Control the camera and look at the visualization from different angles
const controls = new OrbitControls(camera, renderer.domElement)

function convertUtmToImage(x, y) {
    const sceneX = (x - bounds[0]) / (boundsWidth / sceneWidth) - sceneWidth / 2;
    const sceneY = (y - bounds[1]) / (boundsHeight / sceneHeight) - sceneHeight / 2;
    return [sceneX, sceneY]
}

// load data
d3.csv('../data/zipWithLatLon_property_sales.csv')
    .then(data => {
        data = data.filter(d => +d.mean_sale < 4000000)
        data.forEach(d => {
            d.laty = d.lat;
            d.latx = d.lng;
            d.utmy = d.coordsy;
            d.utmx = d.coordsx;
            d.meanSale = +d.mean_sale;
            d.sceneX = convertUtmToImage(d.utmx, d.utmy)[0]
            d.sceneY = convertUtmToImage(d.utmx, d.utmy)[1]
        })
        const minSaleForScale = 100000;
        barHeightScale.domain([minSaleForScale, d3.max(data, d => d.meanSale)])
        colorScale.domain([minSaleForScale / 100,
            // d3.median(data, d => d.meanSale),
            d3.max(data, d => d.meanSale)
        ])

        addNYC();
        addLights();
        addCubes(data)
        render()
        init()
        // requestAnimationFrame(render);
        
    })

function addNYC() {
    const nycPlane = new THREE.PlaneGeometry(sceneWidth, sceneHeight, 1)

    const nycTexture = new THREE.TextureLoader().load('../earth-img/nyc-names-1080hd.jpg');
    const nycMaterial = new THREE.MeshPhongMaterial({
        map: nycTexture,
        shininess: 0.2,
    })

    nyc = new THREE.Mesh(nycPlane, nycMaterial);;
    scene.add(nyc);
}

function addLights() {
    light = new THREE.DirectionalLight(0x3333ee, 3.5, 500);
    light.position.set(posX, posY, posZ)
    scene.add(light);
}



function addCubes(dt) {
    const cubeGroupGeo = new THREE.BoxGeometry(1, 1, 1);
    const cubeGroupMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00
    });
    group = new THREE.Group();
    dt.forEach((d, i) => {
        const value = barHeightScale(d.meanSale)
        var geometry = new THREE.BoxGeometry(boxSize, boxSize, value);
        var material = new THREE.MeshBasicMaterial({
            color: colorScale(d.meanSale),
            transparent: true
        });

        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(d.sceneX, d.sceneY, 0);
        cube.name = d['BOROUGH.NAME'];
        group.add(cube)

    })
    scene.add(group);
}


function render(time) {
    controls.update();
    // var timer = Date.now() * 0.0001;
    // camera.position.x = (Math.cos(timer) * 1800);
    // camera.position.z = (Math.sin(timer) * 1800);
    // camera.lookAt(scene.position);
    light.position.set(camera.position.x, camera.position.y, camera.position.z);
    light.lookAt(scene.position);
    renderer.render(scene, camera);
    TWEEN.update(time);
    requestAnimationFrame(render);

}

const container = d3.select('main');
const stepSel = container.selectAll('.step');

const manhatton = convertUtmToImage(586738, 4515080)
const brooklyn = convertUtmToImage(589395, 4503739)
const bronx = convertUtmToImage(595692, 4522141)

function updateCamera(targetData, cameraNewAngleVector, selBorough = '') {
    TWEEN.removeAll();
    const origin = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        value: camera.zoom,
        r: nyc.rotation.z,
    }

    new TWEEN.Tween(origin)
        .to(targetData, 1500)
        .onUpdate(() => {
            camera.position.set(origin.x, origin.y, origin.z);
            camera.zoom = origin.value;
            camera.updateProjectionMatrix();
            nyc.rotation.z = origin.r;
            group.rotation.z = origin.r;
            if (targetData.index > 0) {
                group.children.forEach(c => {
                        if (c.name !== selBorough) {
                            c.visible = false;
                        } else {
                            c.visible = true;
                        } 
                })
            } else {
                group.children.forEach(c => {
                    c.visible = true;
                })
            }
        })
        .start();

    new TWEEN.Tween(controls.target)
        .to(cameraNewAngleVector, 1500)
        .start();

    render()

}


function updateChart(index) {
    const target0 = {
        index: 0,
        x: posX,
        y: posY,
        z: posZ,
        value: 1,
        r: 0,
    }
    const target2 = {
        index: 2,
        x: manhatton[0] - 10,
        y: manhatton[1] - 2000,
        z: posZ - 10,
        value: target0.value + 8,
        r: target0.r + 1
    }
    const target3 = {
        index: 3,
        x: brooklyn[0],
        y: brooklyn[1] - 2000,
        z: posZ - 10,
        value: target0.value + 8,
        r: target0.r
    }
    const target4 = {
        index: 4,
        x: bronx[0] - 100,
        y: bronx[1] - 2000,
        z: posZ,
        value: target0.value + 9,
        r: target0.r
    }
    if (index == 0 || index == 1) {
        updateCamera(target0, new THREE.Vector3(0, 0, 0))
    } else if (index == 2) {
        updateCamera(target2, new THREE.Vector3(-100, 100, 0), 'Manhattan')
    } else if (index == 3) {
        updateCamera(target3, new THREE.Vector3(40, 0, 0), 'Brooklyn')
    } else {
        updateCamera(target4, new THREE.Vector3(50, 100, 0), 'Bronx')
    }

    // requestAnimationFrame(render);
    // const sel = container.select(`[data-index='${index}']`);
    // stepSel.classed('is-active', (d, i) => i === index);

}


function init() {
    Stickyfill.add(d3.select('.sticky').node());

    enterView({
        selector: stepSel.nodes(),
        offset: 0.3,
        enter: el => {
            const index = +d3.select(el).attr('data-index');
            updateChart(index);
        },
        exit: el => {
            let index = +d3.select(el).attr('data-index');
            index = Math.max(0, index - 1);
            updateChart(index);
        }
    });
}