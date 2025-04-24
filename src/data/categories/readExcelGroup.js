import * as XLSX from "xlsx";
import axios from "axios";

import { Store } from "../../flux";

const fetchAllData = async () => {
  let allData = [];
  let page = 1;
  let hasMoreData = true;

  while (hasMoreData) {
    try {
      const response = await axios.get(`https://mfd-cms-test.onrender.com/api/category-groups?pagination[page]=${page}&pagination[pageSize]=25`);
      
      if (!response.data || !response.data.data) {
        console.error('Invalid API response structure:', response);
        break;
      }

      const transformedData = response.data.data.map(item => ({
        KumpulanKategori: item.KumpulanKategori || '',
        GroupCategory: item.GroupCategory || '',
        Remark: item.Remark || ''
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

const restructureJSONGroup = (data) => {
  if (!Array.isArray(data)) {
    console.error('Invalid data structure received:', data);
    return [];
  }

  const validGroups = data
    .filter(item => {
      // Validate existence and type of required fields
      return item && 
             item.GroupCategory && typeof item.GroupCategory === 'string' &&
             item.KumpulanKategori && typeof item.KumpulanKategori === 'string';
    })
    .map(item => {
      try {
        // Safely extract group components with null checks
        const group = item.GroupCategory.split('/')[0]?.trim() || '';
        const kumpulan = item.KumpulanKategori.split('/')[0]?.trim() || '';
        
        // Validate extracted values before returning
        if (!group || !kumpulan) {
          console.warn('Invalid group structure:', item);
          return null;
        }

        return {
          group,
          kumpulan,
          remark: item.Remark || '', // Changed from null to empty string
          groupCategory: item.GroupCategory.trim(),
          kumpulanKategori: item.KumpulanKategori.trim()
        };
      } catch (error) {
        console.error('Error processing item:', item, error);
        return null;
      }
    })
    .filter(Boolean);

  // Remove duplicates with additional null check
  const uniqueGroups = [];
  const seenGroups = new Set();
  
  validGroups.forEach(group => {
    if (group?.group && !seenGroups.has(group.group)) {
      seenGroups.add(group.group);
      uniqueGroups.push(group);
    }
  });

  // Final validation before return
  return uniqueGroups.length > 0 ? uniqueGroups : [{
    group: 'default',
    kumpulan: 'default',
    remark: null,
    groupCategory: '',
    kumpulanKategori: ''
  }];
};

const readExcelGroup = async () => {
  const promise = new Promise(async (resolve, reject) => {
    try {
      const data = await fetchAllData();
      const reconData = restructureJSONGroup(data);
      resolve(reconData);
    } catch (error) {
      reject(error);
    }
  });
  return promise;
};

// Export the function instead of its result
export default readExcelGroup;
