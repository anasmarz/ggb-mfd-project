import axios from "axios";
import { Store } from "../../flux";

const fetchAllData = async () => {
  let allData = [];
  let page = 1;
  let hasMoreData = true;

  while (hasMoreData) {
    try {
      const response = await axios.get(`https://mfd-cms-test.onrender.com/api/alphabet-entries?pagination[page]=${page}&pagination[pageSize]=25`);
      
      // Handle API response structure
      if (!response.data || !response.data.data) {
        console.error('Invalid API response structure:', response);
        break;
      }

      const transformedData = response.data.data.map(item => ({
        KumpulanKategori: item.KumpulanKategori || '',
        GroupCategory: item.GroupCategory || '',
        Word: item.Word || '',
        Perkataan: item.Perkataan || '',
        Video: item.Video || '',
        Tag: item.Tag || '',
        Release: item.Release || '',
        New: item.New || 'No',
        SOTD: item.SOTD || '',
        Order: item.Order || '',
        ImageStatus: item.Image_Status || ''
      }));

      allData = [...allData, ...transformedData];
      hasMoreData = page < response.data.meta.pagination.pageCount;
      page++;
    } catch (err) {
      console.error("Error fetching data:", err);
      hasMoreData = false;
    }
  }
  return allData;
};

const restructureJSON = (data) => {
  const reconData = data.map((item) => {
    const attributes = item.attributes || item;
    return (attributes.KumpulanKategori !== undefined && 
            attributes.GroupCategory !== undefined && 
            attributes.Word !== undefined && 
            attributes.Perkataan !== undefined) && {
      kumpulanKategori: attributes.KumpulanKategori.toString().replaceAll(/(\r\n|\n|\r)/gm, ''),    
      groupCategory: attributes.GroupCategory.toString().replaceAll(/(\r\n|\n|\r)/gm, ''),    
      word: attributes.Word.toString().trim(),
      perkataan: attributes.Perkataan.toString().trim(),
      video: attributes.Video,
      tag: attributes.Tag,
      release: attributes.Release,
      new: attributes.New,
      order: attributes.Order,
      sotd: attributes.SOTD,
      imgStatus: attributes.ImageStatus
    };
  });

  return filterExcelData(reconData, ["Release 1", "Release 2", "Release 3"]);
};

const filterExcelData = (excelData, releases) => {
  return excelData
    .filter((group) => (group !== false))
    .filter((group) => 
      Array.isArray(releases) ? (releases.includes(group.release)) : (group.release === releases)
    )
    .sort((a, b) => (a.kumpulanKategori).localeCompare(b.kumpulanKategori));
};

// Create an object with a method that returns a promise
const readExcel = {
  getData: function() {
    return new Promise(async (resolve, reject) => {
      try {
        const data = await fetchAllData();
        const reconData = restructureJSON(data);
        resolve(reconData);
      } catch (error) {
        reject(error);
      }
    });
  }
};

export default readExcel;
