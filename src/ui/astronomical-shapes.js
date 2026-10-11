// Rendering-only astronomical refinement. The canonical historical shapes in
// campaign/data.js are immutable because player saves use their star indices.
const ORION_DISPLAY={
 pts:[[84,22],[204,26],[112,52],[144,55],[176,58],[96,100],[205,102],[64,54],[224,59],[146,16],[150,91],[42,100],[244,101],[40,21],[255,25],[147,70],[149,80]],
 edges:[[0,2],[2,3],[3,4],[4,1],[2,5],[4,6],[3,15],[15,16],[16,10],[7,0],[1,8],[9,0]]
};
export function astronomicalDisplayShape(shape){
 if(shape?.name!=="Orion")return shape;
 return {...shape,pts:ORION_DISPLAY.pts,edges:ORION_DISPLAY.edges};
}
