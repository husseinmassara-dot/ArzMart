const db = require('../config/db');
const { fileToBase64 } = require('../utils/fileHelper');

exports.getCategories = async (req, res) => {
  try {
    const categories = await db.allAsync(`
      SELECT c.*, p.name_ar as parent_name_ar, p.name_en as parent_name_en 
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      ORDER BY c.sort_order ASC, c.id ASC
    `);
    res.json(categories);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error_ar: 'خطأ في جلب التصنيفات', error_en: 'Error fetching categories' });
  }
};


exports.createCategory = async (req, res) => {
  const { name_ar, name_en, parent_id } = req.body;
  const imageUrl = req.file ? fileToBase64(req.file) : '';

  if (!name_ar || !name_en) {
    return res.status(400).json({ error_ar: 'الرجاء إدخال اسم التصنيف باللغتين', error_en: 'Please enter category name in both languages' });
  }

  const pid = parent_id && parent_id !== 'null' ? parseInt(parent_id) : null;

  try {
    if (pid) {
      const parentExists = await db.getAsync('SELECT id FROM categories WHERE id = ?', [pid]);
      if (!parentExists) {
        return res.status(400).json({ error_ar: 'التصنيف الأب المحدد غير موجود', error_en: 'The selected parent category does not exist' });
      }
    }

    const result = await db.runAsync(
      'INSERT INTO categories (name_ar, name_en, parent_id, image_url) VALUES (?, ?, ?, ?)',
      [name_ar, name_en, pid, imageUrl]
    );
    res.status(201).json({
      message_ar: 'تم إضافة التصنيف بنجاح',
      message_en: 'Category added successfully',
      category: {
        id: result.lastID,
        name_ar,
        name_en,
        parent_id: pid,
        image_url: imageUrl
      }
    });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error_ar: 'خطأ في إضافة التصنيف', error_en: 'Error adding category' });
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name_ar, name_en, parent_id } = req.body;
  
  const pid = parent_id && parent_id !== 'null' ? parseInt(parent_id) : null;

  try {
    const category = await db.getAsync('SELECT * FROM categories WHERE id = ?', [id]);
    if (!category) {
      return res.status(404).json({ error_ar: 'التصنيف غير موجود', error_en: 'Category not found' });
    }

    // Don't allow setting parent to itself
    if (pid === parseInt(id)) {
      return res.status(400).json({ error_ar: 'لا يمكن تعيين التصنيف كأب لنفسه', error_en: 'Category cannot be its own parent' });
    }

    // Prevent circular dependencies (cycles of any depth)
    if (pid) {
      const parentExists = await db.getAsync('SELECT id FROM categories WHERE id = ?', [pid]);
      if (!parentExists) {
        return res.status(400).json({ error_ar: 'التصنيف الأب المحدد غير موجود', error_en: 'The selected parent category does not exist' });
      }

      let currentParentId = pid;
      while (currentParentId) {
        if (currentParentId === parseInt(id)) {
          return res.status(400).json({
            error_ar: 'لا يمكن تعيين هذا التصنيف كأب لأنه سيسبب حلقة دائرية مغلقة',
            error_en: 'Cannot set this parent category as it would create a circular dependency'
          });
        }
        const parent = await db.getAsync('SELECT parent_id FROM categories WHERE id = ?', [currentParentId]);
        currentParentId = parent ? parent.parent_id : null;
      }
    }

    let imageUrl = category.image_url;
    if (req.file) {
      imageUrl = fileToBase64(req.file) || category.image_url;
    }

    await db.runAsync(
      'UPDATE categories SET name_ar = ?, name_en = ?, parent_id = ?, image_url = ? WHERE id = ?',
      [name_ar, name_en, pid, imageUrl, id]
    );

    res.json({
      message_ar: 'تم تحديث التصنيف بنجاح',
      message_en: 'Category updated successfully',
      category: {
        id: parseInt(id),
        name_ar,
        name_en,
        parent_id: pid,
        image_url: imageUrl
      }
    });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error_ar: 'خطأ في تعديل التصنيف', error_en: 'Error updating category' });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const category = await db.getAsync('SELECT * FROM categories WHERE id = ?', [id]);
    if (!category) {
      return res.status(404).json({ error_ar: 'التصنيف غير موجود', error_en: 'Category not found' });
    }

    // Set parent_id to null for sub-categories first to prevent ON DELETE CASCADE from deleting them
    await db.runAsync('UPDATE categories SET parent_id = NULL WHERE parent_id = ?', [id]);

    // Now delete the category safely
    await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);

    res.json({ message_ar: 'تم حذف التصنيف بنجاح', message_en: 'Category deleted successfully' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error_ar: 'خطأ في حذف التصنيف', error_en: 'Error deleting category' });
  }
};

exports.reorderCategories = async (req, res) => {
  const { order } = req.body; // array of { id, sort_order }
  if (!Array.isArray(order) || order.length === 0) {
    return res.status(400).json({ error_ar: 'بيانات الترتيب غير صحيحة', error_en: 'Invalid order data' });
  }

  try {
    await Promise.all(order.map(({ id, sort_order }) =>
      db.runAsync('UPDATE categories SET sort_order = ? WHERE id = ?', [sort_order, id])
    ));
    res.json({ message_ar: 'تم حفظ ترتيب التصنيفات بنجاح', message_en: 'Category order saved successfully' });
  } catch (err) {
    console.error('Reorder categories error:', err);
    res.status(500).json({ error_ar: 'خطأ في حفظ الترتيب', error_en: 'Error saving order' });
  }
};

exports.bulkUpdateParent = async (req, res) => {
  const { categoryIds, parentId } = req.body;

  if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
    return res.status(400).json({
      error_ar: 'الرجاء تحديد تصنيف واحد على الأقل',
      error_en: 'Please select at least one category'
    });
  }

  const pid = parentId && parentId !== 'null' ? parseInt(parentId, 10) : null;

  try {
    if (pid) {
      const parentExists = await db.getAsync('SELECT id FROM categories WHERE id = ?', [pid]);
      if (!parentExists) {
        return res.status(400).json({
          error_ar: 'التصنيف الأب المحدد غير موجود',
          error_en: 'The selected parent category does not exist'
        });
      }

      if (categoryIds.includes(pid)) {
        return res.status(400).json({
          error_ar: 'لا يمكن نقل التصنيف ليكون ابناً لنفسه',
          error_en: 'Cannot move a category under itself'
        });
      }

      // Check circular references for each category
      for (const id of categoryIds) {
        let currentParentId = pid;
        while (currentParentId) {
          if (currentParentId === parseInt(id, 10)) {
            return res.status(400).json({
              error_ar: 'لا يمكن نقل التصنيفات المحددة لأنها ستسبب حلقة دائرية مغلقة',
              error_en: 'Cannot move these categories as it would create a circular dependency'
            });
          }
          const parent = await db.getAsync('SELECT parent_id FROM categories WHERE id = ?', [currentParentId]);
          currentParentId = parent ? parent.parent_id : null;
        }
      }
    }

    const placeholders = categoryIds.map(() => '?').join(',');
    await db.runAsync(`UPDATE categories SET parent_id = ? WHERE id IN (${placeholders})`, [pid, ...categoryIds]);

    res.json({
      message_ar: 'تم نقل التصنيفات بنجاح',
      message_en: 'Categories moved successfully'
    });
  } catch (err) {
    console.error('Bulk update parent error:', err);
    res.status(500).json({
      error_ar: 'خطأ أثناء نقل التصنيفات',
      error_en: 'Error moving categories'
    });
  }
};
